"use client";

import { Scale } from "lucide-react";
import { useMemo, useState } from "react";
import { IntakeChart } from "@/components/charts/intake-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import { labelForKey, shiftDayKey } from "@/lib/dates";
import { BLOAT_LABELS, phaseLabel } from "@/lib/macros";
import { computeAdherence } from "@/server/analytics/adherence";
import { computeDeficit } from "@/server/analytics/deficit";
import { ma7Series } from "@/server/analytics/ma7";
import type { DailyRecord, DayTarget } from "@/server/analytics/types";
import { HowCalculated } from "./how-calculated";

const RANGES = [
  { key: "14", label: "14 d", days: 14 },
  { key: "30", label: "30 d", days: 30 },
  { key: "90", label: "90 d", days: 90 },
  { key: "todo", label: "Todo", days: null },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

/** «mié 8 jul» → «8 jul» para los ejes/tablas compactas. */
const chartLabel = (date: string) => labelForKey(date).replace(/^\S+\s/, "");
const kcal = (n: number) => Math.round(n).toLocaleString("es-ES");

export function Tendencia({
  records,
  currentTarget,
  today,
}: {
  records: DailyRecord[];
  currentTarget: DayTarget;
  today: string;
}) {
  const [range, setRange] = useState<RangeKey>("90");

  const rangeRecords = useMemo(() => {
    const def = RANGES.find((r) => r.key === range);
    if (!def || def.days == null) return records;
    const lo = shiftDayKey(today, -(def.days - 1));
    return records.filter((r) => r.date >= lo && r.date <= today);
  }, [records, range, today]);

  const deficit = useMemo(() => computeDeficit(rangeRecords), [rangeRecords]);
  const adherence = useMemo(() => computeAdherence(records, today, 14), [records, today]);

  const weightData = useMemo(() => {
    const ma7 = new Map(ma7Series(rangeRecords).map((p) => [p.date, p.ma7]));
    return rangeRecords
      .filter((r) => r.weight != null)
      .map((r) => ({
        label: chartLabel(r.date),
        weight: r.weight,
        ma7: ma7.get(r.date) ?? null,
      }));
  }, [rangeRecords]);

  const intakeData = useMemo(
    () =>
      rangeRecords
        .filter((r) => r.logged)
        .map((r) => ({
          label: chartLabel(r.date),
          kcal: Math.round(r.kcal),
          special: r.phase != null,
        })),
    [rangeRecords],
  );

  const lastDays = useMemo(() => records.slice(-14).reverse(), [records]);

  return (
    <div className="space-y-4 pb-4">
      {/* Selector de rango (F6.6) */}
      <div className="flex justify-end">
        <div
          className="inline-flex rounded-lg border border-line bg-surface-2 p-0.5"
          role="group"
          aria-label="Rango temporal"
        >
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRange(r.key)}
              aria-pressed={range === r.key}
              className={`num rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                range === r.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <TrendCard deficit={deficit} />
      <AdherenceCard adherence={adherence} />

      {/* Gráfico de peso + ma7 */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h2 className="card-title text-muted-foreground">Peso y media de 7 días</h2>
          <HowCalculated
            title="Media móvil de 7 días"
            what="La línea gruesa suaviza el ruido diario del peso (sodio, glucógeno, WODs) promediando los 7 días previos."
            formula="ma7(día) = media de los pesos de [día−6, día]. Se excluyen los días de fase especial y los 2 días tras una competición."
            action="Fíjate en la pendiente de la línea gruesa, no en los saltos diarios de la fina."
          />
        </div>
        <WeightChart data={weightData} />
      </section>

      {/* Barras de ingesta vs objetivo */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h2 className="card-title text-muted-foreground">Ingesta diaria</h2>
          <HowCalculated
            title="Ingesta vs objetivo"
            what="Cada barra es el total de kcal registradas ese día; la línea es tu objetivo. Los días de fase especial se muestran atenuados (no cuentan como desviación)."
            formula="barra = suma de kcal de las comidas del día · línea = objetivo de la versión de dieta vigente."
            action="Busca constancia alrededor de la línea; picos aislados los absorbe la calibración por peso."
          />
        </div>
        <IntakeChart data={intakeData} target={currentTarget.kcal} />
      </section>

      <LastDaysTable rows={lastDays} />
    </div>
  );
}

// ── TrendCard invertida (F6.2 / 05-DISENO §5): única tarjeta de jerarquía máxima ──
function TrendCard({ deficit }: { deficit: ReturnType<typeof computeDeficit> }) {
  if (!deficit.enough) {
    return (
      <section className="rounded-xl bg-foreground p-4 text-background">
        <h2 className="card-title text-background/70">
          Tu gasto y déficit reales · desde el peso
        </h2>
        <div className="mt-3 flex items-start gap-3">
          <Scale className="mt-0.5 size-5 shrink-0 text-background/70" aria-hidden />
          <p className="text-[13px] text-background/90">
            Necesito ≥8 pesajes en al menos una semana para calcular tu déficit
            real. Pésate a diario en ayunas.
            <br />
            <span className="num text-background/70">
              Llevas {deficit.weighins}/8 pesajes válidos.
            </span>
          </p>
        </div>
      </section>
    );
  }

  const kg = deficit.kgPerWeek ?? 0;
  const kgStr = `${kg > 0 ? "+" : ""}${kg.toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  })}`;

  return (
    <section className="rounded-xl bg-foreground p-4 text-background">
      <div className="flex items-center gap-1.5">
        <h2 className="card-title text-background/70">
          Tu gasto y déficit reales · desde el peso
        </h2>
        <HowCalculated
          invert
          title="Déficit y TDEE reales"
          what="El gasto real sale de cuánto cambia tu peso medio, no del reloj (que se equivoca 15-30% en fuerza/CrossFit)."
          formula="déficit/día = −(kg/semana × 7.700 ÷ 7). TDEE = ingesta media de días Normal + déficit. kg/semana = pendiente de la ma7."
          action="Esta es la cifra que manda. Si el déficit es más agresivo de lo pautado, coméntalo con tu nutricionista."
        />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Figure label="kg / semana" value={kgStr} />
        <Figure
          label="déficit kcal/día"
          value={(deficit.deficitKcal ?? 0).toLocaleString("es-ES")}
        />
        <Figure
          label="TDEE real"
          value={deficit.tdee != null ? deficit.tdee.toLocaleString("es-ES") : "—"}
        />
      </div>

      <p className="mt-3 text-[12px] text-background/60">
        Las kcal del reloj y las sesiones son contexto ·{" "}
        <span className="num">{deficit.weighins}</span> pesajes en{" "}
        <span className="num">{deficit.spanDays}</span> días · ingesta media{" "}
        <span className="num">{(deficit.intakeMean ?? 0).toLocaleString("es-ES")}</span> kcal
      </p>
    </section>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="num text-[26px] leading-none font-bold"
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-background/60">{label}</div>
    </div>
  );
}

// ── Adherencia (F6.3) ──
function AdherenceCard({
  adherence,
}: {
  adherence: ReturnType<typeof computeAdherence>;
}) {
  const { n, normalN, enRango, protOk } = adherence;
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-1.5">
        <h2 className="card-title text-muted-foreground">Adherencia · 14 días</h2>
        <HowCalculated
          title="Adherencia (14 días)"
          what="Cuántos días has registrado y, de los de fase Normal, cuántos caen en rango de kcal y de proteína. Las fases especiales se excluyen (pasarse ahí no es desviación)."
          formula="en rango = |kcal − objetivo| / objetivo ≤ 10% · proteína OK = prot ≥ 90% del objetivo. Solo días Normal."
          action="Si registras poco, el resto de métricas pierden fiabilidad: la constancia es lo primero."
        />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={`${n}`} label="días con registro" />
        <Stat value={`${enRango}/${normalN}`} label="en rango kcal" tone="protein" />
        <Stat value={`${protOk}/${normalN}`} label="proteína ✓" tone="protein" />
      </div>
    </section>
  );
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: "protein";
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2.5">
      <div
        className={`num text-[22px] leading-none font-bold ${
          tone === "protein" ? "text-protein" : "text-foreground"
        }`}
        style={{ fontFamily: "var(--font-condensed)" }}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}

// ── Últimos días (F4.4) — al final de Tendencia (09 §2) ──
function LastDaysTable({ rows }: { rows: DailyRecord[] }) {
  if (rows.length === 0) {
    return (
      <section className="rounded-xl border border-dashed border-line bg-surface-2 p-6">
        <p className="text-[13px] text-muted-foreground">
          Aún no hay días registrados. Empieza en Hoy: pésate y añade tus comidas.
        </p>
      </section>
    );
  }
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="card-title border-b border-line px-4 py-2.5 text-muted-foreground">
        Últimos días
      </h2>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.date} className="px-4 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[13px] font-medium text-foreground">
                {labelForKey(r.date)}
              </span>
              <span className="num text-[13px] text-muted-foreground">
                {r.weight != null ? `${r.weight.toLocaleString("es-ES")} kg` : "— kg"}
                {" · "}
                {r.logged ? `${kcal(r.kcal)} kcal` : "sin registro"}
              </span>
            </div>
            <div className="num mt-0.5 text-[12px] text-muted-foreground">
              {[
                r.sessionLabel ?? null,
                phaseLabel(r.phase),
                r.activeKcal != null ? `${r.activeKcal} act.` : null,
                r.steps != null ? `${r.steps.toLocaleString("es-ES")} pasos` : null,
                r.hrvMs != null ? `HRV ${Math.round(r.hrvMs)}` : null,
                r.sleepH != null && r.sleepH > 0
                  ? `${r.sleepH.toLocaleString("es-ES")} h`
                  : null,
                r.bloat ? `hinchazón ${BLOAT_LABELS[r.bloat].toLowerCase()}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
