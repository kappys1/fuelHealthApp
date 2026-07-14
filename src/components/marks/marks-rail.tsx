"use client";

import { Trophy } from "lucide-react";
import { useState } from "react";
import {
  formatMarkValue,
  latestEntry,
  MEASURE_TYPE_LABELS,
} from "@/lib/marks";
import type { MarkDTO } from "@/server/db/queries/marks";
import { MarkDetailSheet } from "./mark-detail-sheet";
import { useMarks } from "./use-marks";

/*
  Carril «Marcas» del Historial (F03 · Progreso). Tira horizontal de marcas; al
  tocar una abre EL MISMO sheet de detalle que en Plan·Entrenos (edición/borrado
  con undo incluidos). La creación de marcas vive en Plan; aquí solo se consultan.
*/
export function MarksRail({
  initialMarks,
  today,
}: {
  initialMarks: MarkDTO[];
  today: string;
}) {
  const { marks, addEntry, updateEntry, deleteEntry, restoreEntry, deleteMark } =
    useMarks(initialMarks);
  const [detailId, setDetailId] = useState<number | null>(null);
  const detailMark = marks.find((m) => m.id === detailId) ?? null;

  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
        <Trophy className="size-3.5" aria-hidden /> Marcas
      </h2>

      {marks.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-2 px-3 py-3 text-[12px] text-muted-foreground">
          Aún no has registrado marcas. Créalas en Plan · Entrenos.
        </p>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {marks.map((m) => {
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
