/*
  Parser JSON de las Automations de Health Auto Export (03-DATOS §4.1) — PURO.

  Formato esperado (tolerante — el shape de HAE varía por versión):
    { data: { metrics: [ { name, units, data: [{ date, qty }] } ], workouts?: [] } }
  También se acepta `{ metrics: [...] }` sin envoltorio `data`.

  Cada métrica se mapea por `name` (inglés o español) y se convierte por `units`
  (kJ→kcal, mL→L). Puntos sin fecha 'YYYY-MM-DD' o sin valor numérico se ignoran.
  Nunca lanza sobre datos malformados: lo que no se entiende, se descarta.
*/
import {
  convertByUnits,
  convertUnits,
  CUMULATIVE_FIELDS,
  extractDayKey,
  extraAgg,
  extraKey,
  type HealthDay,
  type HealthField,
  INTEGER_FIELDS,
  MAX_FIELDS,
  normalizeKey,
  parseNumberEs,
} from "./normalize";

export interface WorkoutRow {
  date: string;
  type: string;
  durationMin: number | null;
  avgHr: number | null;
  activeKcal: number | null;
}

export interface JsonParseResult {
  days: HealthDay[];
  workouts: WorkoutRow[];
  fields: HealthField[];
  hadKj: boolean;
}

// Mapeo nombre-de-métrica → campo (substrings, normalizados). Cubre nombres HAE
// en inglés (identificadores) y en español.
const NAME_MATCHERS: ReadonlyArray<{ field: HealthField; needles: string[] }> = [
  { field: "steps", needles: ["step_count", "step count", "conteo de pasos", "pasos", "steps"] },
  { field: "activeKcal", needles: ["active_energy", "active energy", "energia activa"] },
  {
    field: "basalKcal",
    // Sin «basal» a secas: colisiona con basal_body_temperature. Se exige energía.
    needles: ["basal_energy", "basal energy", "resting_energy", "energia en reposo", "energia basal"],
  },
  {
    field: "hrvMs",
    needles: ["heart_rate_variability", "variabilidad", "hrv", "variability"],
  },
  { field: "sleepH", needles: ["sleep_analysis", "sleep", "sueno", "dormido", "asleep"] },
  {
    field: "restingHr",
    needles: ["resting_heart_rate", "resting heart", "cardiaca en reposo"],
  },
  { field: "vo2max", needles: ["vo2"] },
  { field: "waterL", needles: ["dietary_water", "water", "agua"] },
  {
    field: "weight",
    // OJO: nada de «body_mass»/«body mass» a secas → colisionan con
    // «lean_body_mass» / «Masa Corporal Magra». «weight» ya cubre
    // «weight_body_mass» y «Weight & Body Mass»; «peso» cubre «Peso Corporal».
    needles: ["weight_body_mass", "weight", "peso"],
  },
  { field: "bodyFatPct", needles: ["body_fat_percentage", "body fat", "grasa corporal"] },
];

function matchField(nameNorm: string): HealthField | null {
  for (const { field, needles } of NAME_MATCHERS) {
    if (needles.some((n) => nameNorm.includes(n))) return field;
  }
  return null;
}

function isKjUnit(units: string): boolean {
  return normalizeKey(units).includes("kj");
}
function isMlUnit(units: string): boolean {
  const u = normalizeKey(units);
  return u === "ml" || u.includes("ml)") || u.startsWith("ml");
}

/** Extrae un número de un punto de dato: `qty`, o campos alternativos de sueño. */
function pointValue(pt: Record<string, unknown>): number | null {
  const candidates = [pt.qty, pt.Avg, pt.avg, pt.value, pt.asleep, pt.totalSleep];
  for (const c of candidates) {
    const n = parseNumberEs(typeof c === "string" || typeof c === "number" ? c : null);
    if (n != null) return n;
  }
  return null;
}

function asRecord(x: unknown): Record<string, unknown> | null {
  return x != null && typeof x === "object" ? (x as Record<string, unknown>) : null;
}

function nestedQty(x: unknown): number | null {
  if (typeof x === "number") return Number.isFinite(x) ? x : null;
  const r = asRecord(x);
  if (r && "qty" in r) return parseNumberEs(r.qty as number | string | null);
  return parseNumberEs(typeof x === "string" ? x : null);
}

export function parseHaeJson(input: unknown): JsonParseResult {
  const root = asRecord(input);
  const dataNode = root ? (asRecord(root.data) ?? root) : null;
  const metricsRaw = dataNode?.metrics;
  const metrics = Array.isArray(metricsRaw) ? metricsRaw : [];

  // Acumulador por (fecha, clave). HAE manda VARIAS muestras/día (por hora); se
  // agregan según la métrica: acumulativas → suma, sueño → máximo, resto → media.
  // Las métricas NO tipadas se guardan igualmente bajo la clave "x:<nombre>" para
  // acabar en la columna `extra` (capturamos TODO para el agente).
  type AggKind = "sum" | "max" | "avg";
  interface Cell {
    sum: number;
    count: number;
    max: number;
    agg: AggKind;
    typed: boolean;
  }
  const acc = new Map<string, Map<string, Cell>>();
  const order: string[] = [];
  const fields = new Set<HealthField>();
  let hadKj = false;

  for (const mRaw of metrics) {
    const m = asRecord(mRaw);
    if (!m) continue;
    const rawName = String(m.name ?? "");
    const nameNorm = normalizeKey(rawName);
    const field = matchField(nameNorm);
    const units = String(m.units ?? "");
    const points = Array.isArray(m.data) ? m.data : [];

    // Clave del acumulador + cómo agregar + si es campo tipado.
    let accKey: string;
    let agg: AggKind;
    if (field) {
      accKey = field;
      agg = MAX_FIELDS.has(field) ? "max" : CUMULATIVE_FIELDS.has(field) ? "sum" : "avg";
    } else {
      const k = extraKey(rawName);
      if (!k) continue; // métrica sin nombre → se ignora
      accKey = `x:${k}`;
      agg = extraAgg(nameNorm);
    }
    const typed = !!field;
    const isKj = typed && (field === "activeKcal" || field === "basalKcal") && isKjUnit(units);
    const isMl = typed && field === "waterL" && isMlUnit(units);

    let sawValue = false;
    for (const ptRaw of points) {
      const pt = asRecord(ptRaw);
      if (!pt) continue;
      const date = extractDayKey(String(pt.date ?? pt.Date ?? ""));
      if (!date) continue;
      const value = pointValue(pt);
      if (value == null) continue;
      sawValue = true;
      const converted = typed
        ? convertUnits(field, value, { isKj, isMl })
        : convertByUnits(value, units);
      if (isKj || (!typed && normalizeKey(units).includes("kj"))) hadKj = true;

      let dayAcc = acc.get(date);
      if (!dayAcc) {
        dayAcc = new Map();
        acc.set(date, dayAcc);
        order.push(date);
      }
      const cur = dayAcc.get(accKey) ?? { sum: 0, count: 0, max: -Infinity, agg, typed };
      cur.sum += converted;
      cur.count += 1;
      cur.max = Math.max(cur.max, converted);
      dayAcc.set(accKey, cur);
    }
    if (sawValue && field) fields.add(field);
  }

  // Finaliza: aplica la agregación; campos tipados → columnas, resto → extra.
  const byDate = new Map<string, HealthDay>();
  for (const date of order) {
    const dayAcc = acc.get(date);
    if (!dayAcc) continue;
    const day: HealthDay = { date };
    const extra: Record<string, number> = {};
    for (const [key, c] of dayAcc) {
      const v = c.agg === "max" ? c.max : c.agg === "sum" ? c.sum : c.sum / c.count;
      if (c.typed) {
        const f = key as HealthField;
        day[f] = INTEGER_FIELDS.has(f) ? Math.round(v) : v;
      } else {
        extra[key.slice(2)] = Math.round(v * 1000) / 1000;
      }
    }
    if (Object.keys(extra).length > 0) day.extra = extra;
    byDate.set(date, day);
  }

  // ── workouts (opcional) ──
  const workoutsRaw = dataNode?.workouts;
  const workouts: WorkoutRow[] = [];
  if (Array.isArray(workoutsRaw)) {
    for (const wRaw of workoutsRaw) {
      const w = asRecord(wRaw);
      if (!w) continue;
      const date = extractDayKey(String(w.start ?? w.date ?? ""));
      if (!date) continue;
      const type = String(w.name ?? w.workoutTypeName ?? w.type ?? "Entrenamiento");
      const durNum = parseNumberEs(
        typeof w.duration === "number" || typeof w.duration === "string"
          ? w.duration
          : null,
      );
      const active = nestedQty(w.activeEnergyBurned ?? w.activeEnergy ?? w.totalEnergy);
      const activeKcal =
        active != null
          ? Math.round(isKjUnit(String(unitsOf(w.activeEnergyBurned ?? w.activeEnergy))) ? active / 4.184 : active)
          : null;
      const avgHr = nestedQty(w.avgHeartRate ?? w.averageHeartRate);
      workouts.push({
        date,
        type,
        durationMin: durNum != null ? Math.round(durNum) : null,
        avgHr: avgHr != null ? Math.round(avgHr) : null,
        activeKcal,
      });
    }
  }

  return {
    days: order.map((d) => byDate.get(d) as HealthDay),
    workouts,
    fields: [...fields],
    hadKj,
  };
}

function unitsOf(x: unknown): string {
  const r = asRecord(x);
  return r && typeof r.units === "string" ? r.units : "";
}
