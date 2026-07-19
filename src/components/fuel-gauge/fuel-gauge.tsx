"use client";

import { CircleDashed } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface Targets {
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

// Orden de comidas del plan (para los puntos sobre el anillo de kcal).
const GAUGE_MEALS: MealKey[] = ["almuerzo", "comida", "merienda", "cena", "extra"];
// Opacidad decreciente por comida (mismo lenguaje que la v1: el más reciente/lejano
// más tenue); "extra" en naranja de grasa.
const MEAL_ALPHA: Record<MealKey, number> = {
  almuerzo: 1,
  comida: 0.82,
  merienda: 0.64,
  cena: 0.46,
  extra: 1,
};

interface MealPoint {
  meal: MealKey;
  frac: number;
  kcal: number;
}

/**
 * FuelGauge (Restyle v2 · componente firma). Anillo de kcal (con puntos de comida
 * sobre el arco) + anillos de proteína e hidratos + rail de grasa + línea de estado.
 * El veredicto sale de `gaugeVerdict` (fuente única UI↔coach). Fase especial = anillo
 * azul-info que nunca regaña. El acceso al Coach ya NO vive aquí: es una tarjeta
 * on-demand propia (Restyle v2 · #71).
 */
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
  const subtotals = subtotalsByMeal(entries);
  const v = gaugeVerdict(targets, totals, phase);
  const special = v.phase !== "normal";
  const competicion = v.phase === "competicion";
  const over = v.over;

  const rem = {
    kcal: v.kcalRemaining,
    prot: v.prot.remaining,
    carb: v.carb.remaining,
    fat: v.fat.remaining,
  };

  // Puntos de comida sobre el anillo de kcal: posición acumulada de cada comida
  // registrada (fracción del objetivo). "Puntos de comida en el anillo" (norte).
  const points: MealPoint[] = [];
  let cum = 0;
  for (const m of GAUGE_MEALS) {
    const k = subtotals[m].kcal;
    if (k > 0) {
      cum += k;
      points.push({ meal: m, frac: cum / (targets.kcal || 1), kcal: k });
    }
  }

  const pct = (val: number, target: number) =>
    target > 0 ? (val / target) * 100 : 0;

  const title = competicion
    ? "Modo competición"
    : special
      ? `Fase ${phaseLabel(phase)}`
      : v.covered
        ? "Objetivo cumplido"
        : over
          ? "Por encima del objetivo"
          : "En progreso";

  return (
    <section
      className={cn(
        "rounded-[18px] border p-4 shadow-[var(--card-shadow)]",
        special ? "border-primary/40" : "border-line",
      )}
      style={{ background: special ? "var(--phase)" : "var(--surface)" }}
      aria-label="Presupuesto del día"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="card-title text-muted-foreground">Combustible</p>
        <span
          className={cn(
            "text-[13px] font-semibold",
            competicion || special
              ? "text-primary"
              : v.covered
                ? "text-protein"
                : "text-foreground",
          )}
        >
          {title}
        </span>
      </div>

      {/* Fila de anillos: kcal (grande, con puntos de comida) + proteína + hidratos */}
      <div className="mt-3 grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2">
        <Ring
          main
          progress={pct(v.consumed, targets.kcal)}
          isPhase={special}
          isOver={over && !special}
          points={points}
          value={v.consumed.toLocaleString("es-ES")}
          label="kcal"
          sub={`de ${targets.kcal.toLocaleString("es-ES")}`}
        />
        <Ring
          progress={pct(totals.prot, targets.prot)}
          color="var(--protein)"
          value={displayMacro(totals.prot)}
          label="Proteína"
          sub={`de ${displayMacro(targets.prot)} g`}
        />
        <Ring
          progress={pct(totals.carb, targets.carb)}
          color="var(--carb)"
          value={displayMacro(totals.carb)}
          label="Hidratos"
          sub={`de ${displayMacro(targets.carb)} g`}
        />
      </div>

      {/* Grasa: rail horizontal (presupuesto a no rebasar) */}
      <div className="mt-4 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
        <span className="text-[11px] font-semibold text-muted-foreground">Grasa</span>
        <span
          className="h-1.5 overflow-hidden rounded-full"
          style={{ background: "var(--surface-2)" }}
          aria-hidden
        >
          <span
            className="block h-full rounded-full transition-[width] duration-200"
            style={{
              width: `${Math.min(pct(totals.fat, targets.fat), 100)}%`,
              background: "var(--fat)",
            }}
          />
        </span>
        <span className="num text-[12px] font-semibold text-foreground">
          {displayMacro(totals.fat)}
          <span className="font-normal text-muted-foreground">
            {" "}
            / {displayMacro(targets.fat)} g
          </span>
        </span>
      </div>

      {/* Línea de estado / «Faltan…» */}
      <p className="mt-3 flex items-center gap-2 border-t border-line pt-3 text-[12px] text-muted-foreground">
        <CircleDashed className="size-[15px] shrink-0 text-primary" aria-hidden />
        {competicion ? (
          <span>El gauge no regaña hoy. Registra el repostaje entre WODs.</span>
        ) : special ? (
          <span className="text-primary">
            Fase {phaseLabel(phase)}: superar el objetivo es esperado; este día no
            cuenta como desviación.
          </span>
        ) : over ? (
          <span className="num font-semibold text-destructive">
            +{v.kcalOver.toLocaleString("es-ES")} kcal por encima del objetivo
          </span>
        ) : v.covered ? (
          <span className="font-medium text-protein">Objetivos cubiertos ✓</span>
        ) : (
          <span>
            Faltan <span className="num text-foreground">{rem.kcal.toLocaleString("es-ES")}</span> kcal ·{" "}
            <span className="num">{displayMacro(rem.prot)}</span> g prot ·{" "}
            <span className="num">{displayMacro(rem.carb)}</span> g hidr ·{" "}
            <span className="num">{displayMacro(rem.fat)}</span> g grasa
          </span>
        )}
      </p>
    </section>
  );
}

/** Anillo SVG (track + progreso). El principal lleva puntos de comida sobre el arco. */
function Ring({
  progress,
  color,
  isPhase,
  isOver,
  main,
  points,
  value,
  label,
  sub,
}: {
  progress: number;
  color?: string;
  isPhase?: boolean;
  isOver?: boolean;
  main?: boolean;
  points?: MealPoint[];
  value: string | number;
  label: string;
  sub: string;
}) {
  const dash = Math.min(Math.max(progress, 0), 100);
  const stroke = isPhase
    ? "var(--info)"
    : isOver
      ? "var(--destructive)"
      : (color ?? "var(--primary)");

  return (
    <div
      className="relative mx-auto aspect-square w-full"
      style={{ maxWidth: main ? 140 : 92 }}
      role="img"
      aria-label={`${value} ${label}, ${sub}`}
    >
      <svg viewBox="0 0 120 120" className="h-full w-full overflow-visible">
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          strokeWidth={7}
          stroke="var(--surface-2)"
          pathLength={100}
        />
        <circle
          cx="60"
          cy="60"
          r="50"
          fill="none"
          strokeWidth={7}
          stroke={stroke}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${dash} 100`}
          style={{
            transform: "rotate(-90deg)",
            transformOrigin: "60px 60px",
            transition: "stroke-dasharray 260ms ease",
          }}
        />
        {main &&
          points?.map((p, i) => {
            const a = (-90 + 360 * Math.min(p.frac, 1)) * (Math.PI / 180);
            const x = 60 + 50 * Math.cos(a);
            const y = 60 + 50 * Math.sin(a);
            return (
              <circle
                key={`${p.meal}-${i}`}
                cx={x}
                cy={y}
                r={4.5}
                fill="var(--surface)"
                stroke={isPhase ? "var(--info)" : "var(--primary)"}
                strokeWidth={2.5}
                opacity={MEAL_ALPHA[p.meal]}
              >
                <title>
                  {MEAL_LABELS[p.meal]}: {roundKcal(p.kcal)} kcal
                </title>
              </circle>
            );
          })}
      </svg>
      <span className="absolute inset-0 grid place-content-center justify-items-center px-[10%] text-center">
        <strong
          className={cn(
            "num block leading-[0.95] font-semibold text-foreground",
            main ? "text-[clamp(22px,7vw,32px)]" : "text-[15px]",
          )}
          style={{ fontFamily: "var(--font-display)" }}
        >
          {value}
        </strong>
        <span className="mt-1 block text-[10px] font-semibold text-muted-foreground">
          {label}
        </span>
        <span className="mt-0.5 block text-[9px] text-muted-foreground">{sub}</span>
      </span>
    </div>
  );
}
