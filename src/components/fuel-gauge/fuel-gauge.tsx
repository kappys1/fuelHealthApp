"use client";

import { CircleDashed, Flag, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  displayMacro,
  type MealKey,
  MEAL_LABELS,
  type PhaseKey,
  phaseLabel,
  roundKcal,
} from "@/lib/macros";
import {
  dayTotals,
  type EntryLike,
  subtotalsByMeal,
} from "@/server/analytics/dayTotals";
import { gaugeVerdict } from "@/server/analytics/gaugeVerdict";

interface Targets {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

const GAUGE_MEALS: MealKey[] = ["almuerzo", "comida", "merienda", "cena", "extra"];
const MEAL_OPACITY: Record<MealKey, number> = {
  almuerzo: 1,
  comida: 0.94,
  merienda: 0.88,
  cena: 0.82,
  extra: 1,
};

export function FuelGauge({
  targets,
  entries,
  phase,
}: {
  targets: Targets;
  entries: EntryLike[];
  phase: PhaseKey | null;
}) {
  const totals = dayTotals(entries);
  const meals = subtotalsByMeal(entries);
  const verdict = gaugeVerdict(targets, totals, phase);
  const hasTarget = targets.kcal > 0 || targets.prot > 0;
  const special = verdict.phase !== "normal";
  const competition = verdict.phase === "competicion";

  const headline = !hasTarget
    ? "Sin objetivo configurado"
    : competition
    ? "Repostaje de competición"
    : special
      ? `Fase ${phaseLabel(phase)}`
      : Math.abs(verdict.consumed - targets.kcal) <= 25
        ? "Objetivo cumplido"
        : verdict.over
          ? `${verdict.kcalOver.toLocaleString("es-ES")} kcal sobre objetivo`
          : "Presupuesto del día";

  return (
    <section
      className={cn(
        "wellness-card overflow-hidden p-[18px]",
        special && "border-primary/35 bg-primary-soft",
      )}
      aria-labelledby="fuel-gauge-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="ui-label">Combustible del día</p>
          <h1
            id="fuel-gauge-title"
            className="mt-1 font-display text-[18px] leading-tight font-semibold text-foreground"
          >
            {headline}
          </h1>
        </div>
        <span
          className={cn(
            "inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold",
            special
              ? "bg-primary/10 text-primary"
              : "bg-surface-2 text-protein",
          )}
        >
          {special ? <Flag className="size-3.5" aria-hidden /> : null}
          {special
            ? phaseLabel(phase)
            : !hasTarget
              ? "Solo registro"
              : entries.length > 0
                ? "En curso"
                : "Sin registros"}
        </span>
      </div>

      <div
        className="mt-4 grid min-w-0 grid-cols-[minmax(0,1.38fr)_minmax(0,.86fr)_minmax(0,.86fr)] items-center gap-2 sm:gap-3"
        aria-label="Presupuesto nutricional del día"
      >
        <BudgetRing
          label="kcal"
          value={verdict.consumed}
          target={targets.kcal}
          color="var(--primary)"
          main
        />
        <BudgetRing
          label="proteína"
          shortLabel="Prot"
          unit="g"
          value={totals.prot}
          target={targets.prot}
          color="var(--protein)"
        />
        <BudgetRing
          label="hidratos"
          shortLabel="Hidr"
          unit="g"
          value={totals.carb}
          target={targets.carb}
          color="var(--carb)"
        />
      </div>

      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <span className="font-medium text-muted-foreground">Grasa</span>
          <span className="font-display font-semibold tabular-nums text-foreground">
            {displayMacro(totals.fat)}
            <span className="font-normal text-muted-foreground">
              {targets.fat > 0 ? ` / ${displayMacro(targets.fat)} g` : " g · sin objetivo"}
            </span>
          </span>
        </div>
        <ProgressRail value={totals.fat} target={targets.fat} color="var(--fat)" />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Distribución por comidas</span>
          <span className="font-display tabular-nums">{entries.length} entradas</span>
        </div>
        <div
          className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
          role="img"
          aria-label={GAUGE_MEALS.filter((meal) => meals[meal].kcal > 0)
            .map(
              (meal) =>
                `${MEAL_LABELS[meal]}: ${roundKcal(meals[meal].kcal)} kilocalorías`,
            )
            .join(", ") || "Sin calorías distribuidas por comidas"}
        >
          {GAUGE_MEALS.map((meal) => {
            const width =
              (targets.kcal > 0 ? meals[meal].kcal / targets.kcal : meals[meal].kcal / Math.max(1, totals.kcal)) * 100;
            return width > 0 ? (
              <span
                key={meal}
                className="h-full shrink-0"
                aria-hidden
                style={{
                  width: `${Math.min(width, 100)}%`,
                  background: meal === "extra" ? "var(--fat)" : "var(--primary)",
                  opacity: MEAL_OPACITY[meal],
                }}
                title={`${MEAL_LABELS[meal]}: ${roundKcal(meals[meal].kcal)} kcal`}
              />
            ) : null;
          })}
        </div>
      </div>

      <div
        className={cn(
          "mt-4 flex items-start gap-2 rounded-xl px-3 py-2.5 text-[12px] leading-relaxed",
          special ? "bg-primary-soft text-primary" : "bg-surface-2 text-muted-foreground",
        )}
      >
        {!hasTarget ? (
          <span>
            Configura una dieta en Plan para comparar el registro con una pauta.
          </span>
        ) : special ? (
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        ) : (
          <CircleDashed className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        )}
        {hasTarget ? (
          special ? (
            <span>
              Superar el objetivo es esperado en esta fase; no cuenta como desviación.
            </span>
          ) : verdict.covered ? (
            <span className="font-medium text-protein">Objetivos cubiertos.</span>
          ) : (
            <span>
              <strong className="font-semibold text-foreground">Faltan</strong>{" "}
              {verdict.kcalRemaining.toLocaleString("es-ES")} kcal
              {targets.prot > 0 ? ` · ${displayMacro(verdict.prot.remaining)} g prot` : ""}
              {targets.carb > 0 ? ` · ${displayMacro(verdict.carb.remaining)} g hidr` : ""}
              {targets.fat > 0 ? ` · ${displayMacro(verdict.fat.remaining)} g grasa` : ""}
            </span>
          )
        ) : null}
      </div>
    </section>
  );
}

function BudgetRing({
  label,
  shortLabel,
  unit,
  value,
  target,
  color,
  main = false,
}: {
  label: string;
  shortLabel?: string;
  unit?: string;
  value: number;
  target: number;
  color: string;
  main?: boolean;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  const shown = main ? Math.round(value).toLocaleString("es-ES") : displayMacro(value);
  const targetShown = main
    ? Math.round(target).toLocaleString("es-ES")
    : displayMacro(target);

  return (
    <div
      className={cn(
        "relative aspect-square min-w-0 place-self-center",
        main ? "w-full max-w-[136px]" : "w-full max-w-[84px]",
      )}
      role="img"
      aria-label={
        target > 0
          ? `${displayMacro(value)} de ${displayMacro(target)} ${unit ?? label}`
          : `${displayMacro(value)} ${unit ?? label}, sin objetivo definido`
      }
    >
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden>
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          stroke="var(--surface-2)"
          strokeWidth="7"
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          pathLength="100"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${pct} 100`}
          transform="rotate(-90 60 60)"
        />
        {main ? (
          <g stroke="var(--line)" strokeWidth="1.5" strokeLinecap="round">
            <line x1="60" y1="7" x2="60" y2="12" />
            <line x1="113" y1="60" x2="108" y2="60" />
            <line x1="60" y1="113" x2="60" y2="108" />
            <line x1="7" y1="60" x2="12" y2="60" />
          </g>
        ) : null}
      </svg>
      <span className="absolute inset-[12%] flex min-w-0 flex-col items-center justify-center text-center">
        <strong
          className={cn(
            "max-w-full truncate font-display leading-none font-semibold tabular-nums text-foreground",
            main ? "text-[24px]" : "text-[16px]",
          )}
        >
          {shown}
        </strong>
        <span className={cn("mt-1 text-muted-foreground", main ? "text-[11px]" : "text-[10px]") }>
          {shortLabel ?? label}
        </span>
        <small className="font-display text-[10px] tabular-nums text-muted-foreground">
          {target > 0 ? `de ${targetShown}${unit ? ` ${unit}` : ""}` : "sin objetivo"}
        </small>
      </span>
    </div>
  );
}

function ProgressRail({
  value,
  target,
  color,
}: {
  value: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min(100, Math.max(0, (value / target) * 100)) : 0;
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}
