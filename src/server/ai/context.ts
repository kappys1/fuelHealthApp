import { dayKey, weekdayName } from "@/lib/dates";
import { effectiveHealthMetric } from "@/lib/effective-health";
import type { FlexibleMealKey } from "@/lib/flexible-meals";
import {
  BLOAT_LABELS,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  phaseLabel,
} from "@/lib/macros";
import {
  resolveTrainingSlot,
  type TrainingByWeekday,
  type TrainingSlotResolution,
} from "@/lib/training-slot";
import {
  bestEntry,
  formatMarkValue,
  formatNumber,
  formatSeconds,
  latestEntry,
  MEASURE_TYPE_LABELS,
  sortEntriesAsc,
} from "@/lib/marks";
import { stripTrainingGroupMarkers, TRAINING_TIPO_LABELS } from "@/lib/training";
import type { ProductDTO } from "@/server/db/queries/lookups";
import type { MarkDTO } from "@/server/db/queries/marks";
import type { AdherenceResult } from "@/server/analytics/adherence";
import {
  classifyClosure,
  MAINTENANCE_BAND,
  type Stance,
  type TrainingTiming,
} from "@/server/analytics/dayClosure";
import type { DeficitResult } from "@/server/analytics/deficit";
import type { EnergyBalance } from "@/server/analytics/energyBalance";
import type { FlexibleImpact } from "@/server/analytics/flexibleImpact";
import type { GaugeVerdict } from "@/server/analytics/gaugeVerdict";
import type { MedWithDelta } from "@/server/analytics/medDeltas";
import type { Trajectory } from "@/server/analytics/trajectory";
import type { DailyRecord } from "@/server/analytics/types";
import type { DatedEntry, DayView } from "@/server/db/queries/day";
import type { TrainingWeekView } from "@/server/db/queries/training";
import type { EffectiveTargets, PlanOptionDTO } from "@/server/db/queries/plan";
import { planOptionsList } from "./prompts";

/*
  Ensamblado de CONTEXTO para las features conversacionales de IA (coach F-IA-6,
  preparar-visita F-IA-7, chat F-IA-8). Formatea datos ya leídos de la BD en las
  líneas EXACTAS que piden los prompts de 04-IA. No llama a la IA ni a la BD.
*/

const num = (n: number, d = 0) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: d });

/**
 * Una línea por día (F-IA-7 / F-IA-8): kcal y macros o «sin registro», peso,
 * sesión, fase, hinchazón, notas entrecomilladas, agua, sueño, HRV.
 * `calendarFallback`: si el día no tiene sesión registrada, la sesión que toca
 * según el calendario semanal (doc 10 A4; se usa solo para el día en curso).
 */
export function dayLine(
  r: DailyRecord,
  slot?: TrainingSlotResolution | null,
  opts?: { includePlannedFlexible?: boolean },
): string {
  const parts: string[] = [r.date];
  parts.push(
    r.logged
      ? `${Math.round(r.kcal)} kcal (${Math.round(r.prot)}P/${Math.round(r.carb)}C/${Math.round(r.fat)}F)`
      : "sin registro",
  );
  if (r.weight != null) parts.push(`peso ${num(r.weight, 1)} kg`);
  if (r.sessionLabel) parts.push(r.sessionLabel);
  else if (slot)
    parts.push(`sin sesión registrada (patrón habitual: ${slot.value})`);
  if (
    r.sessionLabel &&
    slot &&
    slot.value !== "descanso" &&
    slot.value !== "sin_dato"
  ) {
    parts.push(
      `franja ${slot.value}${slot.origin === "patron" ? " (patrón habitual)" : ""}`,
    );
  } else if (r.sessionLabel && slot?.value === "sin_dato") {
    parts.push("franja sin dato");
  }
  parts.push(`fase ${phaseLabel(r.phase)}`);
  if (r.phase == null) {
    for (const meal of r.flexibleMeals.real) {
      parts.push(
        opts?.includePlannedFlexible
          ? `${MEAL_LABELS[meal]} flexible real (sus kcal cuentan; contexto informativo, no fallo ni compensación)`
          : `${MEAL_LABELS[meal]} flexible`,
      );
    }
    if (opts?.includePlannedFlexible) {
      for (const meal of r.flexibleMeals.planned) {
        parts.push(
          `${MEAL_LABELS[meal]} flexible prevista (decisión personal, kcal aún desconocidas; no cerrar ese momento con opciones del plan)`,
        );
      }
    }
  }
  if (r.bloat) parts.push(`hinchazón ${BLOAT_LABELS[r.bloat].toLowerCase()}`);
  if (r.waterL != null) parts.push(`agua ${num(r.waterL, 1)} L`);
  if (r.sleepH != null && r.sleepH > 0) parts.push(`sueño ${num(r.sleepH, 1)} h`);
  if (r.hrvMs != null) parts.push(`HRV ${Math.round(r.hrvMs)}`);
  if (r.notes?.trim()) parts.push(`notas: "${r.notes.trim()}"`);
  return parts.join(" · ");
}

/**
 * Últimos `n` días (con datos) como bloque de líneas. `calendar` (doc 10 A4):
 * para el día en curso sin sesión registrada, anota la sesión que toca según el
 * calendario semanal (mismo tratamiento que el coach para chat/visita).
 */
export function dayLines(
  records: readonly DailyRecord[],
  n: number,
  calendar?: {
    trainingByWeekday: TrainingByWeekday;
    today: string;
    includeCurrentPlannedFlexible?: boolean;
  },
): string {
  const rows = records.slice(-n);
  if (rows.length === 0) return "Sin registros todavía.";
  return rows
    .map((r) => {
      const hasSession =
        !!r.sessionLabel && r.sessionLabel.trim().toLowerCase() !== "descanso";
      const slot =
        calendar && r.date === calendar.today
          ? resolveTrainingSlot({
              date: r.date,
              hasSession,
              sessionFranja: r.sessionFranja ?? null,
              trainingByWeekday: calendar.trainingByWeekday,
            })
          : hasSession && r.sessionFranja
            ? { value: r.sessionFranja, origin: "sesion" as const }
            : null;
      return dayLine(r, slot, {
        includePlannedFlexible:
          calendar?.includeCurrentPlannedFlexible === true &&
          r.date === calendar.today,
      });
    })
    .join("\n");
}

/**
 * Detalle de comidas por item de los últimos días (F02): además de los totales
 * por día (dayLines), el chat ve QUÉ comió en cada comida, con el mismo grano que
 * el coach. Agrupado por fecha, hoy primero. Vacío ("") si no hay comidas en el
 * rango → el prompt omite la sección y el guardarraíl anti-invención cubre el resto.
 */
export function recentMealsDetail(
  entries: readonly DatedEntry[],
  records: readonly DailyRecord[] = [],
): string {
  if (entries.length === 0) return "";
  const flexibleReal = new Set<string>(
    records.flatMap((record) =>
      record.phase == null
        ? record.flexibleMeals.real.map(
            (meal) => `${record.date}:${meal}` as const,
          )
        : [],
    ),
  );
  const byDate = new Map<string, DatedEntry[]>();
  for (const e of entries) {
    const arr = byDate.get(e.date) ?? [];
    arr.push(e);
    byDate.set(e.date, arr);
  }
  const dates = [...byDate.keys()].sort().reverse(); // hoy primero
  return dates
    .map((d) => {
      const items = (byDate.get(d) ?? [])
        .map(
          (e) => {
            const label = flexibleReal.has(`${e.date}:${e.meal}`)
              ? `${e.meal} · Flexible`
              : e.meal;
            return `- [${label}] ${e.name}: ${Math.round(e.kcal)} kcal (${Math.round(e.prot)}P/${Math.round(e.carb)}C/${Math.round(e.fat)}F)`;
          },
        )
        .join("\n");
      return `${d}:\n${items}`;
    })
    .join("\n");
}

/**
 * F21 · Contenido REAL de las sesiones de la SEMANA (lun-dom del plan vigente) para
 * el Chat, cuando el turno va de entreno/lesión/adaptación
 * (detectTrainingAdaptationIntent). Antes el contexto emitía solo `sesión {nombre} ·
 * {tipo}` y descartaba `contenido`, así que el Chat no podía leer los ejercicios
 * («no tengo tu WOD en el registro», caso 28-jul): problema de DATO, no de prompt.
 *
 * La ventana es la SEMANA del plan (no solo hoy): un caso real de uso pedía leer «la
 * de ayer» y adaptar «viendo todo lo que tengo de la semana» (29-jul) → una sola
 * fuente cubre leer días pasados/futuros de la semana Y el equilibrio entre sesiones.
 * Cada sesión con su fecha, día y contenido tal cual se importó (F-IA-10), ordenadas
 * por fecha y marcando HOY. Si un día no tiene sesión, el prompt anti-invención lo
 * cubre (AC6). Solo se inyecta bajo intención → coste cero cuando no aplica (AC8).
 */
export function trainingWeekContext(
  weekView: TrainingWeekView | null,
  today: string,
): string {
  const assigned = (weekView?.sessions ?? [])
    .filter((s) => s.assignedDate != null)
    .sort((a, b) => a.assignedDate!.localeCompare(b.assignedDate!));
  if (assigned.length === 0) {
    return "No hay ninguna sesión de entreno importada para esta semana.";
  }
  const blocks = assigned.map((s) => {
    const date = s.assignedDate!;
    const rel =
      date === today ? " · HOY" : date < today ? " · ya pasado" : " · próximo";
    const tipo = TRAINING_TIPO_LABELS[s.tipo];
    const head = `${date} (${weekdayName(date)})${rel}: ${s.nombre} · ${tipo}`;
    /*
      F25: los marcadores de grupo (`**Etiqueta**`) son PINTURA de la ficha, no
      dato. El Chat tiene que recibir exactamente el mismo texto que recibía
      antes de que existieran, para que el comportamiento de F21 (adaptar el
      entreno ante una limitación) no cambie ni haya que re-validarlo.
    */
    const contenido = stripTrainingGroupMarkers(s.contenido).trim();
    return contenido
      ? `${head}\n${contenido}`
      : `${head} (sin contenido detallado importado)`;
  });
  const todayNote = assigned.some((s) => s.assignedDate === today)
    ? ""
    : `\n\nHoy (${today}) no tienes ninguna sesión asignada en el plan.`;
  return `Sesiones de esta semana (contenido real; úsalo, no inventes):\n\n${blocks.join("\n\n")}${todayNote}`;
}

/**
 * Marcas de rendimiento (F03) para el contexto de Chat/Visita (NO Coach diario):
 * cada marca con su última entrada, récord y progresión reciente (últimas 5), para
 * que la IA pueda hablar de PROGRESIÓN bajo demanda. Es interpolación de datos
 * (principio 9); el guardarraíl anti-sobreatribución vive en el prompt. Vacío si no
 * hay marcas con registros → el prompt omite la sección.
 */
export function marksContext(marks: readonly MarkDTO[]): string {
  const lines: string[] = [];
  for (const m of marks) {
    if (m.entries.length === 0) continue;
    const asc = sortEntriesAsc(m.entries);
    const latest = latestEntry(asc);
    const best = bestEntry(m.measureType, asc);
    if (!latest || !best) continue;
    const recent = asc.slice(-5);
    const prog =
      m.measureType === "time"
        ? recent.map((e) => formatSeconds(e.value)).join("→")
        : `${recent.map((e) => formatNumber(e.value)).join("→")} ${m.unit}`;
    const parts = [
      `${m.name} (${MEASURE_TYPE_LABELS[m.measureType]})`,
      `última ${formatMarkValue(m.measureType, latest.value, m.unit)} (${latest.recordedOn})`,
    ];
    if (best.id !== latest.id) {
      parts.push(
        `récord ${formatMarkValue(m.measureType, best.value, m.unit)} (${best.recordedOn})`,
      );
    }
    parts.push(`progresión: ${prog}`);
    lines.push(`- ${parts.join("; ")}.`);
  }
  return lines.join("\n");
}

/**
 * Catálogo «Mis productos» (F07) como contexto de lectura del chat (F12): la
 * etiqueta guardada de un producto de marca es su fuente EXACTA, preferente sobre
 * la web o la memoria (AC1 · caso Lidl). Una línea por producto con su base, macros
 * y origen. Vacío ("") si el catálogo no tiene productos → el prompt omite la
 * sección. Es interpolación de datos (principio 9); la jerarquía de fuentes vive en
 * el prompt. Macros con 1 decimal (respeta la precisión de la etiqueta, p. ej. 0,6 P).
 */
export function productsContext(products: readonly ProductDTO[]): string {
  if (products.length === 0) return "";
  return products
    .map((p) => {
      const base =
        p.baseG != null ? `${p.baseG} ${p.unit}` : `por ${p.unit === "ud" ? "unidad" : p.unit}`;
      const macros = `${num(p.baseProt, 1)}P/${num(p.baseCarb, 1)}C/${num(p.baseFat, 1)}F`;
      const grupo = p.grupo ? ` · ${p.grupo}` : "";
      return `- ${p.name}: ${base} = ${Math.round(p.baseKcal)} kcal · ${macros}${grupo} (${p.source})`;
    })
    .join("\n");
}

/** Historial MED completo (se compara solo consigo mismo, principio 5). */
export function medLines(meds: readonly MedWithDelta[]): string {
  if (meds.length === 0) return "Sin mediciones registradas.";
  return meds
    .map((m) => {
      const bits = [m.date];
      if (m.fatKg != null) bits.push(`grasa ${num(m.fatKg, 2)} kg`);
      if (m.muscleKg != null) bits.push(`músculo ${num(m.muscleKg, 2)} kg`);
      if (m.weightKg != null) bits.push(`peso ${num(m.weightKg, 1)} kg`);
      return bits.join(" · ");
    })
    .join("\n");
}

/**
 * Ventana REAL de la cifra que manda, para que ninguna línea de contexto tenga que
 * inventarse un rótulo (F22 · Fase 1). `deficit.windowDays` viene de la propia
 * función, no de una constante repetida aquí.
 */
/** kg/semana con signo y 2 decimales fijos: −0,20 no es lo mismo que −0,2 al leerlo. */
function signedKg(value: number): string {
  return `${value >= 0 ? "+" : "−"}${Math.abs(value).toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function deficitWindowLabel(deficit: DeficitResult): string {
  const widened = deficit.widened
    ? ", ampliada desde 30 d por pesajes insuficientes"
    : "";
  return `ventana de ${deficit.windowDays} d (${deficit.windowFrom} → ${deficit.windowTo}${widened}), ${deficit.weighins} pesajes`;
}

/** Resumen de tendencia para F-IA-7 (o «Aún sin tendencia fiable»). */
export function trendSummary(deficit: DeficitResult): string {
  if (!deficit.enough || deficit.kgPerWeek == null) {
    return `Aún sin tendencia fiable (${deficitWindowLabel(deficit)}).`;
  }
  const kg = deficit.kgPerWeek;
  const kgStr = `${kg > 0 ? "+" : ""}${num(kg, 2)} kg/semana`;
  const parts = [kgStr];
  if (deficit.deficitKcal != null) {
    parts.push(
      deficit.deficitKcal >= 0
        ? `déficit real ~${num(deficit.deficitKcal)} kcal/día`
        : `superávit estimado ~${num(Math.abs(deficit.deficitKcal))} kcal/día`,
    );
  }
  if (deficit.tdee != null) {
    parts.push(`gasto real estimado ${num(deficit.tdee)} kcal/día`);
  }
  return `${parts.join(", ")} (${deficitWindowLabel(deficit)}).`;
}

/**
 * Trayectoria de meses naturales cerrados (F22). Solo para Chat y Preparar visita:
 * el Coach diario habla de hoy y de ayer, y tres meses de pendiente no cambian
 * ninguna de sus respuestas (presupuesto de prompt).
 */
export function trajectoryLine(trajectory: Trajectory): string {
  if (!trajectory.enough) return "";
  const months = trajectory.months
    .map((month) => {
      if (month.kgPerWeek == null) {
        return `${month.label} — (solo ${month.weighins} pesajes, insuficiente)`;
      }
      return `${month.label} ${signedKg(month.kgPerWeek)} kg/semana`;
    })
    .join(" · ");
  return `Trayectoria por meses naturales cerrados (misma metodología que la cifra que manda, un bloque por mes, sin solape): ${months}. Sirve para decir si el ritmo se mantiene, acelera o frena; no la mezcles con la cifra del mes en curso.`;
}

/**
 * Tendencia + adherencia para el chat (F-IA-8 §3). Desde F22 las cifras SON las de
 * la pantalla: las cuatro superficies llaman a `computeCanonicalDeficit`, que fija
 * la ventana en 30 d y la declara en el propio resultado.
 */
export function trendAndAdherence(
  deficit: DeficitResult,
  adherence: AdherenceResult,
  flexibleImpact?: FlexibleImpact,
  trajectory?: Trajectory,
): string {
  const a = `Adherencia (14 d): ${adherence.n} días con registro; ${adherence.enRango}/${adherence.kcalN} evaluables en rango de kcal, ${adherence.protOk}/${adherence.proteinN} evaluables con proteína suficiente y ${adherence.flexibleN} días flexibles reales fuera del juicio de kcal.`;
  const impact = flexibleImpactLine(flexibleImpact);
  const path = trajectory ? trajectoryLine(trajectory) : "";
  return [trendSummary(deficit), a, impact, path].filter(Boolean).join("\n");
}

function signed(value: number, digits = 0): string {
  const rounded = num(Math.abs(value), digits);
  return `${value >= 0 ? "+" : "−"}${rounded}`;
}

/** Evidencia descriptiva ya calculada; el modelo solo puede narrarla. */
export function flexibleImpactLine(
  impact?: FlexibleImpact,
): string {
  if (
    !impact?.enoughForComparison ||
    impact.flexibleMeanKcal == null ||
    impact.regularMeanKcal == null ||
    impact.flexibleMeanTargetPct == null ||
    impact.regularMeanTargetPct == null ||
    impact.differenceObservedKcal == null ||
    impact.differenceObservedPct == null
  ) {
    return "";
  }
  return `KPI flexible precalculado (${impact.windowDays} d; descriptivo, no causal): ${impact.flexibleMoments} momentos en ${impact.flexibleDays} días; flexibles ${num(impact.flexibleMeanKcal)} kcal (${num(impact.flexibleMeanTargetPct, 1)} % del objetivo, n=${impact.flexibleDays}) vs regulares ${num(impact.regularMeanKcal)} kcal (${num(impact.regularMeanTargetPct, 1)} %, n=${impact.regularDays}); diferencia observada ≈${signed(impact.differenceObservedKcal)} kcal (≈${signed(impact.differenceObservedPct, 1)} %).`;
}

/*
  Datos YA JUZGADOS en servidor para el coach (F-IA-6): el modelo NO recalcula ni
  decide si el día está bien; recibe el mismo veredicto determinista del FuelGauge,
  el balance ingesta−gasto y el déficit real de la báscula (el juez, principio 1).
  El prompt del coach solo gobierna el TONO sobre estas líneas.
*/

/** (a) Veredicto de la app = el MISMO juicio del FuelGauge (coherencia UI↔coach). */
export function gaugeVerdictLine(
  v: GaugeVerdict,
  opts: { faseLabel: string; sessionLabel: string },
): string {
  const macroLabels: Record<"prot" | "carb" | "fat", string> = {
    prot: "proteína",
    carb: "hidratos",
    fat: "grasa",
  };
  let estado: string;
  if (v.phase === "competicion") {
    estado = "modo competición · repostaje libre (no cuenta como desviación)";
  } else if (v.phase === "special") {
    estado =
      "fase especial · superar el objetivo es esperado (no cuenta como desviación)";
  } else if (v.flexible) {
    estado =
      "contexto flexible real · sus kcal cuentan en las cifras, pero no se juzga como fallo ni exige compensación";
  } else if (v.covered) {
    estado = "objetivos cubiertos ✓";
    const overs = v.notablyOver.map(
      (k) => `${macroLabels[k]} +${Math.round(v[k].over)} g sobre objetivo`,
    );
    if (overs.length) estado += ` (ojo: ${overs.join(", ")})`;
  } else {
    const faltan: string[] = [];
    if (v.kcalRemaining > 0) faltan.push(`${v.kcalRemaining} kcal`);
    if (v.prot.remaining > 0)
      faltan.push(`${Math.round(v.prot.remaining)} g proteína`);
    if (v.carb.remaining > 0)
      faltan.push(`${Math.round(v.carb.remaining)} g hidratos`);
    if (v.fat.remaining > 0) faltan.push(`${Math.round(v.fat.remaining)} g grasa`);
    estado = `objetivos sin cubrir (faltan ${faltan.join(", ")})`;
  }
  const kcalDelta = v.over
    ? `+${v.kcalOver}`
    : v.kcalRemaining > 0
      ? `−${v.kcalRemaining}`
      : "±0";
  return `Veredicto de la app (juicio determinista del FuelGauge; ÚSALO tal cual, no lo recalcules): ${estado} — kcal ${kcalDelta} sobre la pauta de ${v.targetKcal}, fase ${opts.faseLabel}, ${opts.sessionLabel}.`;
}

/** (b) Balance ingesta−gasto del día, orientativo (NO es el juez). "" si no hay gasto. */
export function energyBalanceLine(b: EnergyBalance): string {
  if (b.balanceKcal == null || b.expenditureKcal == null) return "";
  const k = Math.round(b.balanceKcal);
  const signo =
    k < 0 ? `déficit ~${Math.abs(k)}` : k > 0 ? `superávit ~${k}` : "equilibrio ~0";
  return `Balance estimado del día (orientativo ±25 %, NO es el juez): ingesta ${Math.round(b.intakeKcal)} kcal − gasto estimado ~${Math.round(b.expenditureKcal)} kcal (${b.breakdown}) ≈ ${signo} kcal.`;
}

/**
 * (c) Déficit real de la báscula = EL juez del déficit (principio 1).
 *
 * F22: el rótulo decía «7 d» y era falso —la ma7 es de 7 días, pero la pendiente se
 * medía sobre el histórico entero—. Ahora dice la ventana canónica real (30 d) leída
 * del propio resultado, la misma que ve Alex en pantalla.
 */
export function trendJudgeLine(deficit: DeficitResult): string {
  if (!deficit.enough || deficit.kgPerWeek == null) {
    return `Déficit real (báscula, ${deficitWindowLabel(deficit)}) — ESTE es el juez (principio 1): aún sin tendencia fiable; no afirmes que «se pasó» basándote solo en las kcal del día.`;
  }
  const kg = deficit.kgPerWeek;
  const kgStr = `${kg > 0 ? "+" : ""}${num(kg, 2)} kg/semana`;
  return `Déficit real (báscula, pendiente de la media móvil de 7 d sobre ${deficitWindowLabel(deficit)}) — ESTE es el juez (principio 1): ~${num(deficit.deficitKcal ?? 0)} kcal/día (${kgStr}).`;
}

/**
 * Contexto retrospectivo de una flexible real. Vive separado de `closureLine`
 * porque el Coach de ayer también debe recibirlo: no hay hueco que cerrar, pero
 * sí una valoración que mantener descriptiva y libre de compensaciones.
 */
export function realFlexibleReviewLine(v: GaugeVerdict): string {
  if (!v.flexible) return "";
  return `CONTEXTO FLEXIBLE REAL: ${v.consumed} kcal/${Math.round(v.prot.value)}P/${Math.round(v.carb.value)}C/${Math.round(v.fat.value)}F se mantienen y cuentan en ingesta/tendencia. No llames fallo a la comida, no atribuyas el peso, HRV, hinchazón ni rendimiento puntual a ella y NO compenses ni prescribas recortes al día siguiente. Llámala Flexible, nunca «cena libre».`;
}

/**
 * (d · F-IA-6 · ai-tuner 25-jul) DIRECTRIZ DE CIERRE del día EN CURSO: qué
 * procede hacer con el hueco (cerrar, priorizar proteína, no tocar, comentar un
 * exceso), YA DECIDIDO en servidor. Sustituye la orden incondicional del prompt
 * («una sugerencia concreta para cuadrar») que provocaba la compulsión de rellenar
 * huecos triviales. Combina la CLASE del cierre (umbrales) con la DOCTRINA del
 * objetivo vigente (techo/banda/suelo, principio 9) y el TIMING de entreno. El
 * prompt solo pone el tono; el modelo NO reclasifica. Solo modo hoy · día real.
 */
export function closureLine(args: {
  stance: Stance;
  verdict: GaugeVerdict;
  timing: TrainingTiming;
  plannedFlexibleMeals?: readonly FlexibleMealKey[];
}): string {
  const { stance, verdict: v, timing } = args;
  const plannedFlexibleMeals = args.plannedFlexibleMeals ?? [];
  const cls = classifyClosure(v);
  const band = Math.round(v.targetKcal * MAINTENANCE_BAND);
  const kcalRem = v.kcalRemaining;
  const kcalOver = v.kcalOver;
  const protRem = Math.round(v.prot.remaining);

  if (v.flexible) {
    return `Directriz de cierre (juicio determinista; síguela tal cual, tú solo pones el tono): ${realFlexibleReviewLine(v)}`;
  }

  if (plannedFlexibleMeals.length > 0) {
    const meals = plannedFlexibleMeals
      .map((meal) => MEAL_LABELS[meal])
      .join(", ");
    const carbRem = Math.round(v.carb.remaining);
    const usefulOtherMoment =
      timing.rel === "mañana" && carbRem >= 20
        ? ` Puedes conservar UNA recomendación útil para otro momento no marcado: coloca los hidratos que procedan (${carbRem} g pendientes) en el desayuno o antes de entrenar para llegar con gasolina.`
        : timing.rel === "tarde" && carbRem >= 20
          ? ` Puedes conservar UNA recomendación útil para otro momento no marcado: coloca los hidratos que procedan (${carbRem} g pendientes) en la comida o la merienda para llegar con gasolina.`
        : "";
    return `Directriz de cierre (juicio determinista; síguela tal cual, tú solo pones el tono): MOMENTO FLEXIBLE PREVISTO (${meals}): decisión personal con kcal aún desconocidas. NO intentes cerrar ese momento con opciones del plan ni rellenar todo el hueco de kcal/macros; no sugieras sus alimentos pautados. Llámalo Flexible, nunca «comida libre».${usefulOtherMoment}`;
  }

  let dir: string;
  if (cls === "exceso") {
    dir =
      stance === "superavit"
        ? `POR ENCIMA (+${kcalOver} kcal): en volumen es lo esperado, no es una desviación; no lo señales como problema.`
        : stance === "mantenimiento"
          ? kcalOver <= band
            ? `EN BANDA: +${kcalOver} kcal, dentro del ±10 % de mantenimiento; no lo comentes como desviación.`
            : `EXCESO leve sobre mantenimiento (+${kcalOver} kcal): obsérvalo sin dramatizar; no prescribas recortes.`
          : `EXCESO: te has pasado ${kcalOver} kcal del techo del día. Coméntalo con calma como observación (la báscula es el juez, no es un fracaso); NO sugieras más comida para «cuadrar».`;
  } else if (cls === "proteina_prioritaria") {
    const head = `PROTEÍNA PRIORITARIA: faltan ${protRem} g de proteína — es lo único material que falta.`;
    dir =
      stance === "superavit"
        ? `${head} Sugiere UNA fuente de proteína magra de su plan y, si queda hueco de kcal para tu suelo, ciérralo también.`
        : stance === "mantenimiento"
          ? `${head} Sugiere UNA fuente de proteína magra de su plan; no persigas el resto de macros.`
          : `${head} Sugiere UNA fuente de proteína magra de las opciones del plan pendientes; el resto del hueco de kcal NO hay que rellenarlo (en definición, quedarse corto en kcal es correcto).`;
  } else if (cls === "hueco_material") {
    dir =
      stance === "superavit"
        ? `HUECO: quedan ${kcalRem} kcal por debajo de tu SUELO. En volumen quedarse corto es el fallo: sugiere cerrarlo con una opción del plan pendiente.`
        : stance === "mantenimiento"
          ? kcalRem <= band
            ? `EN BANDA: quedan ${kcalRem} kcal, dentro del ±10 % de mantenimiento; no hace falta comentarlo.`
            : `HUECO: quedan ${kcalRem} kcal. En mantenimiento no fuerces el cierre; menciónalo solo como opción ligera.`
          : `HUECO MATERIAL: quedan ${kcalRem} kcal con la proteína cubierta. En definición el objetivo es un TECHO: quedarse por debajo es correcto, NO hay que rellenarlo. Como MUCHO, y solo si menciona hambre, ofrece UNA opción del plan como opcional («si tienes hambre…»); no lo conviertas en una tarea.`;
  } else {
    // sin_hueco
    dir =
      stance === "superavit"
        ? `CASI EN EL SUELO: faltan ${kcalRem} kcal para tu objetivo; si te apetece, un cierre pequeño, pero no es crítico.`
        : stance === "mantenimiento"
          ? `DÍA CERRADO: dentro de banda; no sugieras añadidos.`
          : `DÍA CERRADO: solo faltan ${kcalRem} kcal con la proteína cubierta, por debajo del umbral. NO sugieras comida para cuadrar; confírmale que el día está cerrado (en definición, quedarse algo corto es lo correcto).`;
  }

  // Timing de entreno (solo cuando aporta): hidratos pendientes antes/después de
  // la sesión, o descanso sin urgencia. Evita ruido si no hay nada material.
  const carbRem = Math.round(v.carb.remaining);
  const carbMaterial = carbRem >= 20;
  const anythingPending =
    cls === "proteina_prioritaria" || cls === "hueco_material" || carbMaterial;
  let timingLine = "";
  if (timing.rel === "mañana" && carbMaterial) {
    timingLine = ` TIMING: sesión por la mañana — coloca los hidratos pendientes que procedan (${carbRem} g) en el desayuno o antes de entrenar; no los traslades por defecto a la merienda.`;
  } else if (timing.rel === "tarde" && carbMaterial) {
    timingLine = ` TIMING: sesión por la tarde — coloca los hidratos pendientes que procedan (${carbRem} g) en la comida o la merienda.`;
  } else if (timing.rel === "descanso" && carbMaterial) {
    timingLine = ` TIMING: día de descanso — sin urgencia de timing de nutrientes.`;
  } else if (timing.rel === "sin_dato" && anythingPending) {
    timingLine = " TIMING: franja desconocida — no afirmes cuándo colocar la gasolina.";
  }

  return `Directriz de cierre (juicio determinista; síguela tal cual, tú solo pones el tono): ${dir}${timingLine}`;
}

/**
 * Dieta vigente para el chat (F-IA-8 §2): objetivos + opciones del plan CON SUS
 * MACROS por opción, en formato compacto e inequívoco («Carne magra 210 g = 231
 * kcal · 46P/0C/5F»). Antes solo listaba «nombre (gramos)» SIN macros → cuando se
 * le pedía proyectar el día con una opción del plan, el modelo no tenía sus
 * macros y el guardarraíl anti-invención se rendía (DECISIONS #56). Ahora los
 * lleva: sumar/proyectar con ellos NO es inventar.
 */
export function planSummary(
  targets: EffectiveTargets,
  optionsByMeal: Record<string, PlanOptionDTO[]>,
): string {
  const lines = [
    `Objetivos: ${targets.kcal} kcal, ${Math.round(targets.prot)} g proteína, ~${Math.round(targets.carb)} g hidratos, ~${Math.round(targets.fat)} g grasa.`,
    "OPCIONES DEL PLAN (con sus macros — SÍ figuran en tus datos; puedes sumarlas y proyectar el día con ellas):",
  ];
  for (const meal of MEAL_ORDER) {
    if (meal === "extra") continue;
    const opts = optionsByMeal[meal] ?? [];
    if (opts.length === 0) continue;
    const items = opts
      .map((o) => {
        const racion = o.baseG != null ? `${o.baseG} ${o.unit}` : "ración";
        return `  - ${o.name} ${racion} = ${Math.round(o.kcal)} kcal · ${Math.round(o.prot)}P/${Math.round(o.carb)}C/${Math.round(o.fat)}F`;
      })
      .join("\n");
    lines.push(`${MEAL_LABELS[meal]}:\n${items}`);
  }
  return lines.join("\n");
}

/**
 * Opciones del plan de las comidas AÚN pendientes del día (F01 Fase 1, coach
 * F-IA-6): una línea por comida pendiente con sus opciones pautadas (nombre,
 * gramos, kcal, prot). Así el coach sugiere DENTRO de la dieta en vez de inventar
 * comida. Vacío si no queda ninguna comida del plan pendiente. `pending` = claves
 * de comida que aún no tienen entrada registrada (día en curso) o todas (día nuevo).
 */
export function pendingPlanOptions(
  optionsByMeal: Record<string, PlanOptionDTO[]>,
  pending: readonly MealKey[],
): string {
  const lines: string[] = [];
  for (const meal of MEAL_ORDER) {
    if (meal === "extra" || !pending.includes(meal)) continue;
    const opts = optionsByMeal[meal] ?? [];
    if (opts.length === 0) continue;
    lines.push(`${MEAL_LABELS[meal]}: ${planOptionsList(opts)}`);
  }
  return lines.join("\n");
}

/**
 * Contexto del día EN CURSO / TERMINADO para el coach (F-IA-6): comidas con
 * macros por item, totales, peso, sesión (+kcal), fase, agua, hinchazón, notas y
 * métricas del reloj (pasos, activas, basales, HRV, sueño).
 */
export function dayContext(
  view: DayView,
  calendar?: { trainingByWeekday: TrainingByWeekday; date: string },
): string {
  const { day, health, entries } = view;
  const lines: string[] = [];

  if (entries.length === 0) {
    lines.push("Comidas: ninguna registrada aún.");
  } else {
    lines.push("Comidas:");
    for (const e of entries) {
      lines.push(
        `- [${e.meal}] ${e.name}: ${Math.round(e.kcal)} kcal (${Math.round(e.prot)}P/${Math.round(e.carb)}C/${Math.round(e.fat)}F)`,
      );
    }
    const tot = entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + e.kcal,
        prot: acc.prot + e.prot,
        carb: acc.carb + e.carb,
        fat: acc.fat + e.fat,
      }),
      { kcal: 0, prot: 0, carb: 0, fat: 0 },
    );
    lines.push(
      `Totales: ${Math.round(tot.kcal)} kcal · ${Math.round(tot.prot)} g prot · ${Math.round(tot.carb)} g hidr · ${Math.round(tot.fat)} g grasa.`,
    );
  }

  const hasSession =
    !!(view.session || day?.sessionLabel) &&
    day?.sessionLabel?.trim().toLowerCase() !== "descanso";
  const slot = calendar
    ? resolveTrainingSlot({
        date: calendar.date,
        hasSession,
        sessionFranja: view.session?.franja ?? null,
        trainingByWeekday: calendar.trainingByWeekday,
      })
    : null;
  if (!hasSession && slot) {
    const when = calendar?.date === dayKey() ? "hoy" : "ese día";
    lines.push(
      `Sesión: sin registrar (patrón habitual para ${when}: ${slot.value}).`,
    );
  }

  const ctx: string[] = [];
  const weight = effectiveHealthMetric(day?.weight, health?.weight);
  if (weight != null) ctx.push(`peso ${num(weight, 1)} kg`);
  if (view.session) {
    // Sesión REAL del plan de entreno (doc 10 B3): nombre + tipo + gasto estimado.
    const s = view.session;
    const tipo = TRAINING_TIPO_LABELS[s.tipo];
    ctx.push(
      day?.sessionKcal != null
        ? `sesión ${s.nombre} · ${tipo} (~${day.sessionKcal} kcal, contexto ±25%)`
        : `sesión ${s.nombre} · ${tipo}`,
    );
  } else if (day?.sessionLabel) {
    ctx.push(
      day.sessionKcal != null
        ? `sesión ${day.sessionLabel} (~${day.sessionKcal} kcal, contexto ±25%)`
        : `sesión ${day.sessionLabel}`,
    );
  }
  if (hasSession && slot) {
    const origin =
      slot.origin === "sesion"
        ? "dato de la sesión"
        : slot.origin === "patron"
          ? "patrón habitual"
          : "sin dato";
    ctx.push(`franja ${slot.value} (${origin})`);
  }
  ctx.push(`fase ${phaseLabel(day?.phase ?? null)}`);
  const waterL = effectiveHealthMetric(day?.waterL, health?.waterL);
  if (waterL != null) ctx.push(`agua ${num(waterL, 1)} L`);
  if (day?.bloat) ctx.push(`hinchazón ${BLOAT_LABELS[day.bloat].toLowerCase()}`);
  if (health?.steps != null) ctx.push(`${num(health.steps)} pasos`);
  if (health?.activeKcal != null) ctx.push(`${health.activeKcal} kcal activas`);
  if (health?.basalKcal != null) ctx.push(`${health.basalKcal} kcal basales`);
  if (health?.hrvMs != null) ctx.push(`HRV ${Math.round(health.hrvMs)} ms`);
  if (health?.sleepH != null && health.sleepH > 0)
    ctx.push(`sueño ${num(health.sleepH, 1)} h`);
  if (ctx.length) lines.push(`Contexto: ${ctx.join(" · ")}.`);

  if (day?.phase == null) {
    for (const meal of view.flexibleMeals.planned) {
      lines.push(
        `${MEAL_LABELS[meal]} flexible prevista: decisión personal; kcal aún desconocidas. No intentes cerrar ese momento con opciones del plan ni rellenar ese hueco.`,
      );
    }
    for (const meal of view.flexibleMeals.real) {
      lines.push(
        `${MEAL_LABELS[meal]} flexible real: sus kcal sí cuentan en ingesta y tendencia; trátala como contexto informativo, no como fallo; no atribuyas un peso puntual a esa comida y no prescribas compensación.`,
      );
    }
  }

  if (day?.notes?.trim()) lines.push(`Notas: "${day.notes.trim()}".`);

  return lines.join("\n");
}
