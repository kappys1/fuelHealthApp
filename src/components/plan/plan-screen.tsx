"use client";

import Link from "next/link";
import { MarksBlock } from "@/components/marks/marks-block";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import type { MarkDTO } from "@/server/db/queries/marks";
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
  { key: "entrenos", label: "Entrenamientos" },
] as const;
type Segment = (typeof SEGMENTS)[number]["key"];

export function PlanScreen({
  targets,
  derived,
  optionsByMeal,
  week,
  marks,
  today,
  selectedWeek,
  effectiveFrom,
  versionId,
  initialSegment = "dieta",
}: {
  targets: EffectiveTargets | null;
  derived: DerivedTargets | null;
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  week: TrainingWeekView | null;
  marks: MarkDTO[];
  today: string;
  selectedWeek: string;
  effectiveFrom: string | null;
  versionId: number | null;
  initialSegment?: Segment;
}) {
  const segment = initialSegment;

  const hrefFor = (next: Segment) =>
    next === "dieta"
      ? "/plan"
      : `/plan?tab=entrenos&week=${selectedWeek}`;

  return (
    <section className="space-y-6 pb-8">
      <div>
        <p className="ui-label">Plan</p>
        <h1 className="app-page-title mt-1">Dieta y entrenamiento</h1>
      </div>

      <div
        className="grid min-h-12 grid-cols-2 rounded-xl bg-surface-2 p-1"
        role="tablist"
        aria-label="Contenido del plan"
      >
        {SEGMENTS.map((s) => {
          const active = segment === s.key;
          return (
            <Link
              key={s.key}
              href={hrefFor(s.key)}
              scroll={false}
              role="tab"
              aria-selected={active}
              className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-[14px] font-semibold transition-colors ${
                active
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={{ fontFamily: "var(--font-display)" }}
            >
              {s.label}
            </Link>
          );
        })}
      </div>

      {segment === "dieta" ? (
        <PlanClient
          key={versionId ?? "empty-plan"}
          targets={targets}
          derived={derived}
          optionsByMeal={optionsByMeal}
          effectiveFrom={effectiveFrom}
        />
      ) : (
        <div className="space-y-7">
          <TrainingWeek
            key={selectedWeek}
            week={week}
            selectedWeek={selectedWeek}
            today={today}
          />
          <MarksBlock initialMarks={marks} today={today} />
        </div>
      )}
    </section>
  );
}
