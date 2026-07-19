"use client";

import { ChevronDown, Dumbbell, HeartPulse, Watch } from "lucide-react";
import { useState } from "react";
import {
  type BaselineStat,
  BASELINE_METRICS,
  type BetterWhen,
  type HealthMetricKey,
} from "@/server/analytics/healthBaseline";
import { energyBalance } from "@/server/analytics/energyBalance";
import type { DayView } from "@/server/db/queries/day";
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

// ── Envoltura plegable (patrón compartido de las secciones secundarias) ──
function Collapsible({
  title,
  icon,
  summary,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-[18px] border border-line bg-surface shadow-[var(--card-shadow)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 p-3.5 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-primary">
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="card-title text-muted-foreground">{title}</p>
          {summary ? (
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {summary}
            </p>
          ) : null}
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? <div className="px-3.5 pb-4">{children}</div> : null}
    </section>
  );
}

// ── Baseline personal (KPIs del reloj con delta vs media 30 d) ──
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
  const withData = baseline.filter((b) => b.today != null).length;
  const summary =
    withData > 0
      ? `${withData} de ${BASELINE_METRICS.length} métricas hoy · vs media 30 d`
      : "Sin datos del reloj hoy";

  return (
    <Collapsible
      title="Baseline personal"
      icon={<HeartPulse className="size-[18px]" aria-hidden />}
      summary={summary}
    >
      <div className="grid grid-cols-2 gap-2">
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
    </Collapsible>
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
  const summary =
    balance != null
      ? `${balance < 0 ? "Déficit" : "Superávit"} de ${Math.abs(
          Math.round(balance),
        ).toLocaleString("es-ES")} kcal (contexto)`
      : "Sin datos de gasto del reloj";

  return (
    <Collapsible
      title="Contexto del reloj"
      icon={<Watch className="size-[18px]" aria-hidden />}
      summary={summary}
    >
      <div className="space-y-2 text-[13px]">
        <Row label="Ingesta" value={`${Math.round(eb.intakeKcal).toLocaleString("es-ES")} kcal`} />
        <Row
          label="Gasto"
          value={
            eb.expenditureKcal != null
              ? `${Math.round(eb.expenditureKcal).toLocaleString("es-ES")} kcal`
              : "—"
          }
          hint={eb.breakdown}
        />
        <div className="flex items-baseline justify-between border-t border-line pt-2">
          <span className="font-medium text-foreground">Balance</span>
          <span
            className={cn(
              "num font-bold",
              balance == null
                ? "text-muted-foreground"
                : balance < 0
                  ? "text-protein"
                  : "text-foreground",
            )}
          >
            {balance != null
              ? `${balance > 0 ? "+" : ""}${Math.round(balance).toLocaleString("es-ES")} kcal`
              : "—"}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          El reloj es contexto (±). El juez del déficit real es la pendiente de la
          báscula.
        </p>
      </div>
    </Collapsible>
  );
}

function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">
        {label}
        {hint ? <span className="text-[11px]"> · {hint}</span> : null}
      </span>
      <span className="num text-foreground">{value}</span>
    </div>
  );
}
