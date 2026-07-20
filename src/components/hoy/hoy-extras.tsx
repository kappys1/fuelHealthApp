"use client";

import { Dumbbell, Droplets, HeartPulse, Watch } from "lucide-react";
import { type BloatKey, BLOAT_LABELS } from "@/lib/macros";
import {
  type BaselineStat,
  BASELINE_METRICS,
  type BetterWhen,
  type HealthMetricKey,
} from "@/server/analytics/healthBaseline";
import { energyBalance } from "@/server/analytics/energyBalance";
import type { DayView } from "@/server/db/queries/day";
import type { DayPatch } from "@/server/db/queries/mutations";
import { cn } from "@/lib/utils";

/* Secciones de Hoy del Restyle v2 · F1 (Intermedio): Entrenamiento (línea),
   Baseline personal ▾ y Contexto del reloj ▾ (plegados). Todo con datos reales:
   nada se pinta si no hay dato (huecos), y las métricas derivadas salen de
   funciones puras (healthBaseline, energyBalance). */

// ── Entrenamiento del día (sesión + gasto orientativo ±25%) ──
export function EntrenamientoLine({
  view,
  defaultSession,
}: {
  view: DayView;
  defaultSession: string;
}) {
  const nombre =
    view.session?.nombre ?? view.day?.sessionLabel ?? defaultSession;
  const kcal =
    view.day?.sessionKcal ??
    (view.session
      ? Math.round(((view.session.kcalMin ?? 0) + (view.session.kcalMax ?? 0)) / 2)
      : null);
  const descanso = /descanso/i.test(nombre);

  return (
    <section className="flex items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 shadow-[var(--card-shadow)]">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-primary">
        <Dumbbell className="size-[18px]" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="card-title text-muted-foreground">Entrenamiento</p>
        <p className="mt-0.5 truncate text-[14px] font-medium text-foreground">
          {nombre}
        </p>
      </div>
      {!descanso && kcal != null ? (
        <div className="shrink-0 text-right">
          <p className="num text-[15px] font-bold text-foreground">
            ~{kcal.toLocaleString("es-ES")}
          </p>
          <p className="text-[10px] text-muted-foreground">kcal · ±25%</p>
        </div>
      ) : (
        <span className="shrink-0 text-[12px] text-muted-foreground">
          {descanso ? "Descanso" : "Sin gasto estimado"}
        </span>
      )}
    </section>
  );
}

// ── Hinchazón + Agua inline en Hoy (bloat-selector del mockup) ──
const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];
const WATER_CHIPS = [
  { label: "+250 ml", d: 0.25 },
  { label: "+500 ml", d: 0.5 },
  { label: "+ Botella", d: 0.75 },
];

export function HinchazonAguaSection({
  view,
  onPatch,
  onRevisar,
}: {
  view: DayView;
  onPatch: (patch: DayPatch) => void;
  onRevisar: () => void;
}) {
  const day = view.day;
  return (
    <section className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="card-title text-muted-foreground">Hinchazón del día</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Contexto editable, sin atribuir una causa.
          </p>
        </div>
        <button
          type="button"
          onClick={onRevisar}
          className="shrink-0 text-[12px] font-medium text-primary"
        >
          Revisar check-in
        </button>
      </div>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {BLOATS.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => onPatch({ bloat: day?.bloat === b ? null : b })}
            className={cn(
              "rounded-[12px] border py-2 text-[12px] font-medium transition-colors",
              day?.bloat === b
                ? "border-primary bg-primary/10 text-primary"
                : "border-line bg-surface-2 text-muted-foreground",
            )}
          >
            {BLOAT_LABELS[b]}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <Droplets className="size-4 text-primary" aria-hidden /> Agua
        </span>
        <span className="num text-[12px] text-muted-foreground">
          {(day?.waterL ?? 0).toLocaleString("es-ES")} L hoy
        </span>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1.5">
        {WATER_CHIPS.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() =>
              onPatch({
                waterL: Math.round(((day?.waterL ?? 0) + c.d) * 100) / 100,
              })
            }
            className="rounded-full border border-line bg-surface-2 py-2 text-[12px] font-medium text-foreground"
          >
            {c.label}
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Baseline personal (KPIs del reloj con delta vs media 30 d) — siempre visible ──
function fmt(v: number, decimals: number): string {
  return v.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function deltaTone(delta: number, betterWhen: BetterWhen): string {
  if (betterWhen === "neutral" || delta === 0) return "text-muted-foreground";
  const good = betterWhen === "higher" ? delta > 0 : delta < 0;
  return good ? "text-protein" : "text-destructive";
}

export function BaselineSection({ baseline }: { baseline: BaselineStat[] }) {
  const byKey = new Map<HealthMetricKey, BaselineStat>(
    baseline.map((b) => [b.key, b]),
  );
  const sleep = byKey.get("sleepH");
  const showSleepNote = sleep != null && sleep.today == null && sleep.nDays > 0;

  return (
    <section className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary">
          <HeartPulse className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="card-title text-muted-foreground">Baseline personal</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Cómo estás hoy vs tu media de 30 días
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {BASELINE_METRICS.map((m) => {
          const s = byKey.get(m.key);
          const today = s?.today ?? null;
          const delta = s?.delta ?? null;
          const mean30 = s?.mean30 ?? null;
          return (
            <div
              key={m.key}
              className="rounded-[14px] border border-line bg-surface-2 p-3"
            >
              <p className="text-[11px] font-semibold text-muted-foreground">
                {m.label}
              </p>
              <p className="num mt-1 text-[20px] leading-none font-bold text-foreground">
                {today != null ? fmt(today, m.decimals) : "—"}
                {today != null && m.unit ? (
                  <span className="text-[12px] font-normal text-muted-foreground">
                    {" "}
                    {m.unit}
                  </span>
                ) : null}
              </p>
              <p className="mt-1.5 text-[11px]">
                {delta != null ? (
                  <span className={cn("num font-medium", deltaTone(delta, m.betterWhen))}>
                    {delta > 0 ? "+" : ""}
                    {fmt(delta, m.decimals)} vs media 30 d
                  </span>
                ) : mean30 == null ? (
                  <span className="text-muted-foreground">necesito más días</span>
                ) : (
                  <span className="text-muted-foreground">sin dato hoy</span>
                )}
              </p>
            </div>
          );
        })}
      </div>
      {showSleepNote ? (
        <p className="mt-2 text-[11px] text-muted-foreground">
          * Apple Health no registró sueño hoy. Se conserva el dato crudo, pero no se
          interpreta como sueño real.
        </p>
      ) : null}
    </section>
  );
}

// ── Contexto del reloj (balance ingesta − gasto; CONTEXTO, no el juez) ──
export function ContextoRelojSection({
  intakeKcal,
  view,
}: {
  intakeKcal: number;
  view: DayView;
}) {
  const eb = energyBalance({
    intakeKcal,
    basalKcal: view.health?.basalKcal ?? null,
    activeKcal: view.health?.activeKcal ?? null,
    sessionKcal: view.day?.sessionKcal ?? null,
  });

  const balance = eb.balanceKcal;

  return (
    <section className="rounded-[18px] border border-line bg-surface p-4 shadow-[var(--card-shadow)]">
      <div className="flex items-center gap-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary">
          <Watch className="size-[18px]" aria-hidden />
        </span>
        <div>
          <h2 className="card-title text-muted-foreground">
            Balance del día · orientativo ±25%
          </h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {eb.expenditureKcal != null
              ? `${Math.round(eb.intakeKcal).toLocaleString("es-ES")} ingesta − (${eb.breakdown})`
              : "Sin datos de gasto del reloj"}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <p className="text-[12px] text-muted-foreground">
          Apple Watch · no calibra tu déficit real (lo hace la báscula).
        </p>
        <p
          className={cn(
            "num text-[34px] leading-none font-bold",
            balance == null
              ? "text-muted-foreground"
              : balance < 0
                ? "text-protein"
                : "text-foreground",
          )}
        >
          {balance != null
            ? `${balance > 0 ? "+" : ""}${Math.round(balance).toLocaleString("es-ES")}`
            : "—"}
          <span className="ml-1 text-[13px] font-semibold text-muted-foreground">
            kcal
          </span>
        </p>
      </div>
    </section>
  );
}
