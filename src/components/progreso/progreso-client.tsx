"use client";

import { useState } from "react";
import type { DailyRecord, DayTarget } from "@/server/analytics/types";
import { Tendencia } from "./tendencia";

/*
  Pantalla Progreso (09-FLUJOS-UX §2): dos segmentos de una misma pantalla —
  Tendencia | MED — porque responden la misma pregunta («¿funciona?»). Tendencia
  está completa (Fase 3); MED (composición corporal + preparar visita) llega en
  la Fase 4.
*/
const SEGMENTS = [
  { key: "tendencia", label: "Tendencia" },
  { key: "med", label: "MED" },
] as const;
type Segment = (typeof SEGMENTS)[number]["key"];

export function ProgresoClient({
  records,
  currentTarget,
  today,
}: {
  records: DailyRecord[];
  currentTarget: DayTarget;
  today: string;
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
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-surface-2 p-6">
          <p className="text-sm text-foreground">
            MED: composición corporal (grasa, músculo, peso), diferencias entre
            mediciones y «Preparar visita».
          </p>
          <p className="mt-2 text-[12px] text-muted-foreground">Llega en la Fase 4.</p>
        </div>
      )}
    </section>
  );
}
