"use client";

import { Sparkles } from "lucide-react";
import {
  displayMacro,
  isSpecialPhase,
  type MealKey,
  MEAL_LABELS,
  type PhaseKey,
  phaseLabel,
  roundKcal,
} from "@/lib/macros";
import { dayTotals, type EntryLike, subtotalsByMeal } from "@/server/analytics/dayTotals";
import { cn } from "@/lib/utils";

interface Targets {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

// Bloques del gauge = comidas del plan (05-DISENO §1). Cada uno se va llenando.
const GAUGE_MEALS: MealKey[] = ["almuerzo", "comida", "merienda", "cena", "extra"];
// Tono cobalto con opacidad decreciente por comida; "extra" en naranja.
const MEAL_ALPHA: Record<MealKey, number> = {
  almuerzo: 1,
  comida: 0.82,
  merienda: 0.64,
  cena: 0.46,
  extra: 1,
};

export function FuelGauge({
  targets,
  entries,
  phase,
  onCoach,
}: {
  targets: Targets;
  entries: EntryLike[];
  phase: PhaseKey | null;
  onCoach: () => void;
}) {
  const totals = dayTotals(entries);
  const subtotals = subtotalsByMeal(entries);
  const special = isSpecialPhase(phase);
  const competicion = phase === "competicion";

  const consumed = roundKcal(totals.kcal);
  const remaining = targets.kcal - consumed;
  const over = remaining < 0;

  const rem = {
    kcal: Math.max(0, remaining),
    prot: Math.max(0, targets.prot - totals.prot),
    carb: Math.max(0, targets.carb - totals.carb),
    fat: Math.max(0, targets.fat - totals.fat),
  };
  const allCovered = rem.kcal === 0 && rem.prot === 0 && rem.carb === 0 && rem.fat === 0;

  return (
    <section
      className={cn(
        "rounded-xl border p-4",
        special ? "border-primary/40" : "border-line",
      )}
      style={special ? { background: "var(--phase)" } : { background: "var(--surface)" }}
      aria-label="Presupuesto del día"
    >
      {/* Cabecera: cifra crono + restante + coach */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span
              className="num text-[44px] leading-none font-bold text-foreground"
              style={{ fontFamily: "var(--font-condensed)" }}
            >
              {consumed.toLocaleString("es-ES")}
            </span>
            <span className="num text-lg text-muted-foreground">
              / {targets.kcal.toLocaleString("es-ES")}
            </span>
            <span className="text-[12px] text-muted-foreground">kcal</span>
          </div>
          <div className="mt-1">
            {competicion ? (
              <span className="text-[13px] font-medium text-primary">
                Modo competición · repostaje libre
              </span>
            ) : over ? (
              <span
                className={cn(
                  "num text-[15px] font-semibold",
                  special ? "text-primary" : "text-destructive",
                )}
              >
                +{(consumed - targets.kcal).toLocaleString("es-ES")} kcal
              </span>
            ) : (
              <span className="num text-[15px] font-semibold text-foreground">
                Faltan {rem.kcal.toLocaleString("es-ES")} kcal
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onCoach}
          aria-label="Coach (analizar el día)"
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-primary transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <Sparkles className="size-4" aria-hidden />
        </button>
      </div>

      {/* Barra de kcal segmentada por comida */}
      <div
        className="mt-3 flex h-3.5 w-full overflow-hidden rounded-full"
        style={{ background: "var(--surface-2)" }}
        aria-hidden
      >
        {GAUGE_MEALS.map((m) => {
          const pct = (subtotals[m].kcal / targets.kcal) * 100;
          if (pct <= 0) return null;
          const isExtra = m === "extra";
          return (
            <div
              key={m}
              className="h-full shrink-0 transition-[width] duration-200"
              style={{
                width: `${Math.min(pct, 130)}%`,
                background: isExtra ? "var(--fat)" : "var(--primary)",
                opacity: MEAL_ALPHA[m],
              }}
              title={`${MEAL_LABELS[m]}: ${roundKcal(subtotals[m].kcal)} kcal`}
            />
          );
        })}
      </div>

      {/* Proteína (barra propia) + mini-barras C/F */}
      <div className="mt-3 space-y-2">
        <MacroBar
          label="Proteína"
          value={totals.prot}
          target={targets.prot}
          color="var(--protein)"
          big
        />
        <div className="grid grid-cols-2 gap-3">
          <MacroBar label="Hidratos" value={totals.carb} target={targets.carb} color="var(--carb)" />
          <MacroBar label="Grasa" value={totals.fat} target={targets.fat} color="var(--fat)" />
        </div>
      </div>

      {/* Línea «Faltan…» / estado de fase */}
      <div className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[13px]">
        {competicion ? (
          <span className="text-muted-foreground">
            El gauge no regaña hoy. Registra el repostaje entre WODs.
          </span>
        ) : special ? (
          <span className="text-primary">
            Fase {phaseLabel(phase)}: superar el objetivo es esperado; este día no
            cuenta como desviación.
          </span>
        ) : allCovered ? (
          <span className="font-medium text-protein">Objetivos cubiertos ✓</span>
        ) : (
          <span className="text-muted-foreground">
            <span className="text-foreground">Faltan:</span>{" "}
            <span className="num">{rem.kcal.toLocaleString("es-ES")}</span> kcal ·{" "}
            <span className="num">{displayMacro(rem.prot)}</span> g prot ·{" "}
            <span className="num">{displayMacro(rem.carb)}</span> g hidr ·{" "}
            <span className="num">{displayMacro(rem.fat)}</span> g grasa
          </span>
        )}
      </div>
    </section>
  );
}

function MacroBar({
  label,
  value,
  target,
  color,
  big,
}: {
  label: string;
  value: number;
  target: number;
  color: string;
  big?: boolean;
}) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="num text-foreground">
          {displayMacro(value)}
          <span className="text-muted-foreground"> / {displayMacro(target)} g</span>
        </span>
      </div>
      <div
        className={cn("mt-1 w-full overflow-hidden rounded-full", big ? "h-2.5" : "h-1.5")}
        style={{ background: "var(--surface-2)" }}
      >
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
