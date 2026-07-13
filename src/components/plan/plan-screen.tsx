"use client";

import { useState } from "react";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import type { EffectiveTargets, PlanOptionDTO } from "@/server/db/queries/plan";
import type { TrainingWeekView } from "@/server/db/queries/training";
import { PlanClient } from "./plan-client";
import { TrainingWeek } from "./training-week";

/*
  Pantalla Plan (doc 10 B3b): dos segmentos — Dieta | Entrenos — mismo patrón que
  Progreso (Tendencia | MED). Separa "lo que como" de "lo que entreno".
*/
const SEGMENTS = [
  { key: "dieta", label: "Dieta" },
  { key: "entrenos", label: "Entrenos" },
] as const;
type Segment = (typeof SEGMENTS)[number]["key"];

export function PlanScreen({
  targets,
  derived,
  optionsByMeal,
  week,
  initialSegment = "dieta",
}: {
  targets: EffectiveTargets;
  derived: DerivedTargets;
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  week: TrainingWeekView | null;
  initialSegment?: Segment;
}) {
  const [segment, setSegment] = useState<Segment>(initialSegment);

  return (
    <section className="space-y-4">
      <h1 className="card-title text-muted-foreground">Plan</h1>

      <div className="flex border-b border-line" role="tablist" aria-label="Plan">
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSegment(s.key)}
              className={`relative flex-1 pb-2.5 pt-1 text-center text-[14px] font-semibold transition-colors ${
                active ? "text-foreground" : "text-muted-foreground"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {s.label}
              <span
                className={`absolute inset-x-0 -bottom-px mx-auto h-[3px] w-16 rounded-full ${
                  active ? "bg-primary" : "bg-transparent"
                }`}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      {segment === "dieta" ? (
        <PlanClient
          targets={targets}
          derived={derived}
          optionsByMeal={optionsByMeal}
        />
      ) : (
        <TrainingWeek week={week} />
      )}
    </section>
  );
}
