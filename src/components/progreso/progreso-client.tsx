"use client";

import Link from "next/link";
import type { MedWithDelta } from "@/server/analytics/medDeltas";
import type { DailyRecord, DayTarget } from "@/server/analytics/types";
import type { HistorialEntry } from "@/server/db/queries/history";
import type { MarkDTO } from "@/server/db/queries/marks";
import { Historial } from "./historial";
import { Med } from "./med";
import { Tendencia } from "./tendencia";

/*
  Pantalla Progreso (09-FLUJOS-UX §2): segmentos de una misma pantalla —
  Tendencia | MED | Historial. Tendencia y MED responden «¿funciona?»; Historial
  (doc 10 B4) es «cómo he llegado hasta aquí» (timeline de solo lectura).
*/
const SEGMENTS = [
  { key: "tendencia", label: "Tendencia" },
  { key: "med", label: "MED" },
  { key: "historial", label: "Historial" },
] as const;
type Segment = (typeof SEGMENTS)[number]["key"];

export function ProgresoClient({
  records,
  currentTarget,
  today,
  med,
  historial,
  marks,
  initialSegment = "tendencia",
  initialRange = "90",
  initialSummary = 7,
  initialHistoryRange = "all",
  initialHistoryType = "all",
  initialHistoryFrom = "",
  initialHistoryTo = "",
}: {
  records: DailyRecord[];
  currentTarget: DayTarget;
  today: string;
  med: MedWithDelta[];
  historial: HistorialEntry[];
  marks: MarkDTO[];
  initialSegment?: Segment;
  initialRange?: "14" | "30" | "90" | "todo";
  initialSummary?: 7 | 30;
  initialHistoryRange?: "3m" | "6m" | "year" | "all" | "custom";
  initialHistoryType?: "objetivo" | "dieta" | "entreno" | "med" | "all";
  initialHistoryFrom?: string;
  initialHistoryTo?: string;
}) {
  const segment = initialSegment;

  const hrefFor = (next: Segment) => {
    const params = new URLSearchParams();
    if (next !== "tendencia") params.set("tab", next);
    if (initialRange !== "90") params.set("range", initialRange);
    if (initialSummary !== 7) params.set("summary", String(initialSummary));
    if (initialHistoryRange !== "all") params.set("historyRange", initialHistoryRange);
    if (initialHistoryType !== "all") params.set("historyType", initialHistoryType);
    if (initialHistoryFrom) params.set("from", initialHistoryFrom);
    if (initialHistoryTo) params.set("to", initialHistoryTo);
    const query = params.toString();
    return query ? `/progreso?${query}` : "/progreso";
  };

  return (
    <section className="space-y-6 pb-8">
      <div>
        <p className="ui-label">Evolución</p>
        <h1 className="app-page-title mt-1">Progreso</h1>
      </div>

      <div
        className="grid min-h-12 grid-cols-3 rounded-xl bg-surface-2 p-1"
        role="tablist"
        aria-label="Progreso"
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
              className={`flex min-h-11 items-center justify-center rounded-lg px-2 text-center text-[13px] font-semibold transition-colors ${
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

      {segment === "tendencia" ? (
        <Tendencia
          records={records}
          currentTarget={currentTarget}
          today={today}
          range={initialRange}
          summaryDays={initialSummary}
        />
      ) : segment === "med" ? (
        <Med initialMed={med} />
      ) : (
        <Historial
          entries={historial}
          records={records}
          today={today}
          marks={marks}
          range={initialHistoryRange}
          type={initialHistoryType}
          from={initialHistoryFrom}
          to={initialHistoryTo}
          progressRange={initialRange}
          summaryDays={initialSummary}
        />
      )}
    </section>
  );
}
