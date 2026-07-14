"use client";

import { ArrowRight, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  formatMarkValue,
  latestEntry,
  marksByRecency,
  MEASURE_TYPE_LABELS,
} from "@/lib/marks";
import type { MarkDTO } from "@/server/db/queries/marks";
import { MarkDetailSheet } from "./mark-detail-sheet";
import { useMarks } from "./use-marks";

/*
  Carril «Marcas» del Historial (F03 → F04 · Progreso). Consulta rápida: muestra
  solo las marcas ACTUALIZADAS más recientemente (por fecha de su última entrada) +
  «ver todas →» que lleva a Plan·Entrenos (patrón «ir al actual» de Dieta/Entreno).
  Deja de intentar mostrar todas en la tira (no escala a 20-40 marcas). Al tocar una
  abre EL MISMO sheet de detalle que en Plan; la gestión (crear/lista completa) vive
  en Plan·Entrenos.
*/
const RECENT_LIMIT = 5;

export function MarksRail({
  initialMarks,
  today,
}: {
  initialMarks: MarkDTO[];
  today: string;
}) {
  const router = useRouter();
  const { marks, addEntry, updateEntry, deleteEntry, restoreEntry, deleteMark } =
    useMarks(initialMarks);
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailMark = marks.find((m) => m.id === detailId) ?? null;

  const recent = marksByRecency(marks).slice(0, RECENT_LIMIT);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
          <Trophy className="size-3.5" aria-hidden /> Marcas
        </h2>
        {marks.length > 0 ? (
          <button
            type="button"
            onClick={() => router.push("/plan?tab=entrenos")}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-primary"
          >
            Ver todas <ArrowRight className="size-3.5" aria-hidden />
          </button>
        ) : null}
      </div>

      {marks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-2 px-3 py-3 text-[12px] text-muted-foreground">
          Aún no has registrado marcas. Créalas en Plan · Entrenos.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {recent.map((m) => {
            const latest = latestEntry(m.entries);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setDetailId(m.id)}
                className="min-w-[8.5rem] shrink-0 rounded-xl border border-line bg-surface p-3 text-left"
              >
                <div className="truncate text-[13px] font-medium text-foreground">
                  {m.name}
                </div>
                <div className="num mt-1 text-[17px] font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  {latest
                    ? formatMarkValue(m.measureType, latest.value, m.unit)
                    : "—"}
                </div>
                <div className="text-[10.5px] text-muted-foreground">
                  {MEASURE_TYPE_LABELS[m.measureType]} · última
                </div>
              </button>
            );
          })}
          {/* «Ver todas» como última tarjeta del carril → hogar de gestión (Plan). */}
          <button
            type="button"
            onClick={() => router.push("/plan?tab=entrenos")}
            aria-label="Ver todas las marcas en Plan"
            className="flex min-w-[6.5rem] shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-surface-2 p-3 text-[12px] font-medium text-primary"
          >
            <ArrowRight className="size-4" aria-hidden />
            Ver todas
          </button>
        </div>
      )}

      {detailMark ? (
        <MarkDetailSheet
          mark={detailMark}
          today={today}
          onAddEntry={addEntry}
          onUpdateEntry={updateEntry}
          onDeleteEntry={deleteEntry}
          onRestoreEntry={restoreEntry}
          onDeleteMark={deleteMark}
          onClose={() => setDetailId(null)}
        />
      ) : null}
    </section>
  );
}
