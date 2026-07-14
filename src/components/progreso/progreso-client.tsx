"use client";

import { useState } from "react";
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
}: {
  records: DailyRecord[];
  currentTarget: DayTarget;
  today: string;
  med: MedWithDelta[];
  historial: HistorialEntry[];
  marks: MarkDTO[];
}) {
  const [segment, setSegment] = useState<Segment>("tendencia");

  return (
    <section className="space-y-4">
      {/* Control de segmento estilo marcador */}
      <div className="flex border-b border-line" role="tablist" aria-label="Progreso">
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

      {segment === "tendencia" ? (
        <Tendencia records={records} currentTarget={currentTarget} today={today} />
      ) : segment === "med" ? (
        <Med initialMed={med} />
      ) : (
        <Historial entries={historial} today={today} marks={marks} />
      )}
    </section>
  );
}
