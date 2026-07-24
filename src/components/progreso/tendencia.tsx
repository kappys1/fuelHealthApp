"use client";

import { Flame, Scale, Target, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { IntakeChart } from "@/components/charts/intake-chart";
import { WeightChart } from "@/components/charts/weight-chart";
import { labelForKey, shiftDayKey } from "@/lib/dates";
import { computeAdherence } from "@/server/analytics/adherence";
import { computeDeficit } from "@/server/analytics/deficit";
import { ma7Series } from "@/server/analytics/ma7";
import {
  computeLoggingStreak,
  computeProgressSummary,
  macroEnergy,
  type SummaryWindowDays,
} from "@/server/analytics/progressSummary";
import type { DailyRecord, DayTarget } from "@/server/analytics/types";
import { HowCalculated } from "./how-calculated";

const RANGES = [
  { key: "14", label: "14 d", days: 14 },
  { key: "30", label: "30 d", days: 30 },
  { key: "90", label: "90 d", days: 90 },
  { key: "todo", label: "Todo", days: null },
] as const;
export type ProgressRange = (typeof RANGES)[number]["key"];

const chartLabel = (date: string) => labelForKey(date).replace(/^\S+\s/, "");
const integer = (value: number) => Math.round(value).toLocaleString("es-ES");
const periodLabel = (from: string, to: string) =>
  `${chartLabel(from)} – ${chartLabel(to)}`;
const progressHref = (nextRange: ProgressRange, nextSummary: SummaryWindowDays) => {
  const params = new URLSearchParams();
  if (nextRange !== "90") params.set("range", nextRange);
  if (nextSummary !== 7) params.set("summary", String(nextSummary));
  const query = params.toString();
  return query ? `/progreso?${query}` : "/progreso";
};

export function Tendencia({
  records,
  currentTarget,
  today,
  range,
  summaryDays,
}: {
  records: DailyRecord[];
  currentTarget: DayTarget;
  today: string;
  range: ProgressRange;
  summaryDays: SummaryWindowDays;
}) {
  const rangeRecords = useMemo(() => {
    const definition = RANGES.find((item) => item.key === range);
    if (!definition || definition.days == null) return records;
    const from = shiftDayKey(today, -(definition.days - 1));
    return records.filter((record) => record.date >= from && record.date <= today);
  }, [range, records, today]);

  const deficit = useMemo(() => computeDeficit(rangeRecords), [rangeRecords]);
  const adherence = useMemo(() => computeAdherence(records, today, 14), [records, today]);
  const summary = useMemo(
    () => computeProgressSummary(records, today, summaryDays),
    [records, summaryDays, today],
  );
  const streak = useMemo(() => computeLoggingStreak(records, today), [records, today]);

  const weightData = useMemo(() => {
    // La ma7 necesita los 6 días anteriores al borde visible; se calcula sobre toda
    // la historia y solo después se recorta el gráfico.
    const ma7 = new Map(ma7Series(records).map((point) => [point.date, point.ma7]));
    return rangeRecords
      .filter((record) => record.weight != null)
      .map((record) => ({
        label: chartLabel(record.date),
        weight: record.weight,
        ma7: ma7.get(record.date) ?? null,
      }));
  }, [rangeRecords, records]);

  const intakeData = useMemo(
    () =>
      rangeRecords
        .filter((record) => record.logged)
        .map((record) => ({
          label: chartLabel(record.date),
          targetKcal: record.target.kcal,
          special: record.phase != null,
          ...macroEnergy(record),
        })),
    [rangeRecords],
  );
  const averageDiscrepancy =
    intakeData.length > 0
      ? Math.round(
          intakeData.reduce((total, point) => total + point.discrepancyKcal, 0) /
            intakeData.length,
        )
      : null;

  return (
    <div className="space-y-7">
      <div className="space-y-3">
        <div>
          <h2 className="app-section-title">Tendencia real</h2>
          <p className="section-copy">Peso, ingesta y constancia</p>
        </div>
        <div
          className="grid min-h-[52px] w-full grid-cols-4 rounded-xl bg-surface-2 p-1"
          role="group"
          aria-label="Rango temporal"
        >
          {RANGES.map((item) => (
            <Link
              key={item.key}
              href={progressHref(item.key, summaryDays)}
              scroll={false}
              aria-current={range === item.key ? "true" : undefined}
              className={`num flex min-h-11 min-w-11 items-center justify-center rounded-lg px-2 text-[12px] font-semibold transition-colors ${
                range === item.key
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      <TrendCard deficit={deficit} />

      <SummaryCard
        summary={summary}
        currentTarget={currentTarget}
        range={range}
        hrefFor={progressHref}
      />

      <section aria-labelledby="consistency-title">
        <div className="mb-3">
          <h2 id="consistency-title" className="app-section-title">
            Consistencia
          </h2>
          <p className="section-copy">Señales simples, sin puntuaciones inventadas</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <KpiCard
            Icon={Target}
            iconTone="text-protein bg-protein/10"
            label="Adherencia · 14 d"
            value={
              adherence.normalN > 0
                ? `${Math.round((adherence.enRango / adherence.normalN) * 100)}%`
                : "—"
            }
            detail={`${adherence.enRango}/${adherence.normalN} kcal · ${adherence.protOk}/${adherence.normalN} proteína`}
          />
          <KpiCard
            Icon={Flame}
            iconTone="text-fat bg-fat/10"
            label="Racha de registro"
            value={`${streak}`}
            detail={streak === 1 ? "día seguido" : "días seguidos"}
          />
        </div>
      </section>

      <section className="wellness-card p-5" aria-labelledby="weight-chart-title">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="weight-chart-title" className="app-section-title">
              Peso y media móvil
            </h2>
            <p className="section-copy">Peso diario fino · media 7 d destacada</p>
          </div>
          <HowCalculated
            title="Media móvil de 7 días"
            what="La línea gruesa suaviza el ruido diario del peso promediando los 7 días previos."
            formula="ma7(día) = media de los pesos de [día−6, día]. Se excluyen las fases especiales y los 2 días tras competir."
            action="Fíjate en la pendiente de la línea gruesa, no en saltos diarios."
          />
        </div>
        <WeightChart data={weightData} />
      </section>

      <section className="wellness-card p-5" aria-labelledby="intake-chart-title">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 id="intake-chart-title" className="app-section-title">
              Ingesta diaria
            </h2>
            <p className="section-copy">Contribución energética de cada macro</p>
          </div>
          <HowCalculated
            title="Energía por macronutriente"
            what="Cada barra apila kcal de proteína, hidratos y grasa. La línea sigue el objetivo vigente de cada día."
            formula="proteína = g×4 · hidratos = g×4 · grasa = g×9. La diferencia frente a las kcal registradas se informa aparte."
            action="Busca consistencia alrededor del objetivo; las fases especiales son contexto, no desviación."
          />
        </div>
        <MacroLegend />
        <IntakeChart data={intakeData} />
        {averageDiscrepancy != null ? (
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Diferencia media registro − macros:{" "}
            <span className="num font-semibold text-foreground">
              {averageDiscrepancy > 0 ? "+" : ""}
              {integer(averageDiscrepancy)} kcal
            </span>
            . Se muestra aparte y no se mezcla en las barras.
          </p>
        ) : null}
      </section>
    </div>
  );
}

function TrendCard({ deficit }: { deficit: ReturnType<typeof computeDeficit> }) {
  if (!deficit.enough) {
    return (
      <section className="rounded-[22px] bg-[var(--inverted)] p-5 text-[var(--on-inverted)] shadow-card">
        <p className="text-[11px] font-semibold text-[var(--on-inverted-muted)]">
          BALANCE REAL · DESDE EL PESO
        </p>
        <div className="mt-4 flex items-start gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Scale className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold leading-snug">
              Necesito ≥8 pesajes para mostrar una tendencia fiable
            </h2>
            <p className="mt-2 text-[12px] leading-relaxed text-[var(--on-inverted-muted)]">
              Llevas <span className="num font-semibold">{deficit.weighins}/8</span>{" "}
              pesajes válidos. Regístralos en ayunas y la tarjeta se calculará sola.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const kgPerWeek = deficit.kgPerWeek ?? 0;
  const kgValue = `${kgPerWeek > 0 ? "+" : ""}${kgPerWeek.toLocaleString("es-ES", {
    maximumFractionDigits: 2,
  })}`;

  return (
    <section className="rounded-[22px] bg-[var(--inverted)] p-5 text-[var(--on-inverted)] shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-[var(--on-inverted-muted)]">
            BALANCE REAL · DESDE EL PESO
          </p>
          <h2 className="mt-1 text-[16px] font-semibold">La cifra que manda</h2>
        </div>
        <HowCalculated
          invert
          title="Déficit y TDEE reales"
          what="El gasto real sale del cambio de tu peso medio, no del reloj."
          formula="déficit/día = −(kg/semana × 7.700 ÷ 7). TDEE = ingesta media Normal + déficit."
          action="Si el déficit se aleja de la pauta, coméntalo con tu nutricionista."
        />
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3">
        <HeroFigure label="kg / semana" value={kgValue} />
        <HeroFigure
          label={(deficit.deficitKcal ?? 0) >= 0 ? "déficit estimado" : "superávit estimado"}
          value={integer(Math.abs(deficit.deficitKcal ?? 0))}
          unit="kcal / día"
        />
        <HeroFigure
          label="TDEE real"
          value={deficit.tdee != null ? integer(deficit.tdee) : "—"}
          unit="kcal"
        />
      </div>
      <p className="mt-5 border-t border-white/15 pt-3 text-[11px] leading-relaxed text-[var(--on-inverted-muted)]">
        {deficit.weighins} pesajes en {deficit.spanDays} días · ingesta media{" "}
        {integer(deficit.intakeMean ?? 0)} kcal · el reloj queda como contexto.
      </p>
    </section>
  );
}

function HeroFigure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <div className="num truncate text-[24px] font-semibold leading-none">{value}</div>
      {unit ? <div className="mt-1 text-[10px] text-[var(--on-inverted-muted)]">{unit}</div> : null}
      <div className={`${unit ? "mt-0.5" : "mt-1.5"} text-[10px] leading-tight text-[var(--on-inverted-muted)]`}>
        {label}
      </div>
    </div>
  );
}

function SummaryCard({
  summary,
  currentTarget,
  range,
  hrefFor,
}: {
  summary: ReturnType<typeof computeProgressSummary>;
  currentTarget: DayTarget;
  range: ProgressRange;
  hrefFor: (range: ProgressRange, days: SummaryWindowDays) => string;
}) {
  return (
    <section className="wellness-card p-5" aria-labelledby="summary-title">
      <div className="flex flex-col gap-3 min-[370px]:flex-row min-[370px]:items-start min-[370px]:justify-between">
        <div>
          <h2 id="summary-title" className="app-section-title">
            Resumen {summary.days === 7 ? "semanal" : "mensual"}
          </h2>
          <p className="section-copy">
            {periodLabel(summary.from, summary.to)} · {summary.contextDays}{" "}
            {summary.contextDays === 1 ? "fase especial" : "fases especiales"}
          </p>
        </div>
        <div className="flex min-h-[52px] self-start rounded-xl bg-surface-2 p-1" role="group" aria-label="Periodo del resumen">
          {([7, 30] as const).map((days) => (
            <Link
              key={days}
              href={hrefFor(range, days)}
              scroll={false}
              aria-current={summary.days === days ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-lg px-3 text-[11px] font-semibold ${
                summary.days === days
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              {days === 7 ? "Semanal" : "Mensual"}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 border-y border-line">
        <SummaryMetric
          label="Ingesta media"
          value={summary.averageKcal != null ? `${integer(summary.averageKcal)} kcal` : "—"}
        />
        <SummaryMetric
          label="Proteína media"
          value={summary.averageProtein != null ? `${integer(summary.averageProtein)} g` : "—"}
          right
        />
        <SummaryMetric
          label="Días registrados"
          value={`${summary.loggedDays}/${summary.days}`}
          bottom
        />
        <SummaryMetric
          label="En rango normal"
          value={`${summary.kcalInRange}/${summary.normalDays}`}
          right
          bottom
        />
        <SummaryMetric
          label="Pasos medios"
          value={summary.averageSteps != null ? integer(summary.averageSteps) : "—"}
          bottom
        />
        <SummaryMetric
          label="Proteína suficiente"
          value={`${summary.proteinOnTarget}/${summary.normalDays}`}
          right
          bottom
        />
      </div>
      <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <UtensilsCrossed className="size-3.5 text-primary" aria-hidden />
        {currentTarget.kcal > 0 ? (
          <>
            Objetivo vigente: <span className="num font-semibold text-foreground">{integer(currentTarget.kcal)} kcal</span>
          </>
        ) : (
          <span>Sin objetivo vigente en Plan.</span>
        )}
      </p>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
  right = false,
  bottom = false,
}: {
  label: string;
  value: string;
  right?: boolean;
  bottom?: boolean;
}) {
  return (
    <div
      className={`py-3.5 ${right ? "border-l border-line pl-4" : "pr-4"} ${
        bottom ? "border-t border-line" : ""
      }`}
    >
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="num mt-1 text-[18px] font-semibold text-foreground">{value}</div>
    </div>
  );
}

function KpiCard({
  Icon,
  iconTone,
  label,
  value,
  detail,
}: {
  Icon: typeof Target;
  iconTone: string;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="wellness-card min-w-0 p-4">
      <span className={`flex size-9 items-center justify-center rounded-xl ${iconTone}`}>
        <Icon className="size-[18px]" aria-hidden />
      </span>
      <p className="mt-4 text-[11px] text-muted-foreground">{label}</p>
      <p className="num mt-1 text-[26px] font-semibold leading-none text-foreground">{value}</p>
      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{detail}</p>
    </article>
  );
}

function MacroLegend() {
  return (
    <div className="mb-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground" aria-label="Leyenda de macronutrientes">
      {[
        ["Proteína", "var(--protein)"],
        ["Hidratos", "var(--carb)"],
        ["Grasa", "var(--fat)"],
        ["Registrado", "var(--muted-text)"],
        ["Objetivo", "var(--primary)"],
      ].map(([label, color]) => (
        <span key={label} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}
