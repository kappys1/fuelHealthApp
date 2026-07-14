"use client";

import {
  ChevronRight,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  formatMarkValue,
  latestChange,
  latestEntry,
  MEASURE_TYPE_LABELS,
} from "@/lib/marks";
import type { MarkDTO } from "@/server/db/queries/marks";
import { MarkDetailSheet } from "./mark-detail-sheet";
import { MarkRegisterSheet } from "./mark-register-sheet";
import { useMarks } from "./use-marks";

/*
  Bloque «Marcas» de Plan·Entrenos (F03): lista de TODAS las marcas con su última
  entrada como titular; «＋ Marca» abre el sheet de registro; tap en una marca abre
  el sheet de detalle (gráfica + entradas + calculadora de %). No añade nada
  permanente a Hoy (09 §6).
*/
export function MarksBlock({
  initialMarks,
  today,
}: {
  initialMarks: MarkDTO[];
  today: string;
}) {
  const {
    marks,
    createMark,
    addEntry,
    updateEntry,
    deleteEntry,
    restoreEntry,
    deleteMark,
  } = useMarks(initialMarks);
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const detailMark = marks.find((m) => m.id === detailId) ?? null;

  // Filtro en vivo por nombre sobre las marcas ya cargadas (cliente, <50 ms):
  // escala a cualquier volumen sin ir al servidor (F04).
  const q = query.trim().toLowerCase();
  const visible = useMemo(
    () => (q ? marks.filter((m) => m.name.toLowerCase().includes(q)) : marks),
    [marks, q],
  );

  return (
    <section className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <div>
          <h2 className="text-[14px] font-semibold text-foreground">Marcas</h2>
          <p className="text-[12px] text-muted-foreground">
            PRs y registros de rendimiento
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRegisterOpen(true)}
          className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] font-medium text-primary"
        >
          <Plus className="size-4" aria-hidden /> Marca
        </button>
      </div>

      {marks.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
          Sin marcas todavía. Usa «＋ Marca» para registrar tu primer PR (1RM,
          Fran, 5k…).
        </p>
      ) : (
        <>
          {/* Buscador en vivo (F04): filtra la lista por nombre sobre lo cargado. */}
          <div className="border-b border-line px-4 py-2.5">
            <div className="flex items-center gap-2 rounded-lg border border-input bg-surface-2 px-3">
              <Search
                className="size-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar marca (snatch, Fran…)"
                className="h-10 w-full bg-transparent text-base outline-none"
                aria-label="Buscar marca"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Limpiar búsqueda"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" aria-hidden />
                </button>
              ) : null}
            </div>
          </div>

          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">
              Sin marcas para «{query.trim()}».
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {visible.map((m) => (
                <li key={m.id}>
                  <MarkRow mark={m} onOpen={() => setDetailId(m.id)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {registerOpen ? (
        <MarkRegisterSheet
          existingMarks={marks}
          today={today}
          onCreateMark={createMark}
          onAddEntry={addEntry}
          onClose={() => setRegisterOpen(false)}
        />
      ) : null}

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

function MarkRow({ mark, onOpen }: { mark: MarkDTO; onOpen: () => void }) {
  const latest = latestEntry(mark.entries);
  const change = latestChange(mark.measureType, mark.entries);
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 px-4 py-3 text-left"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium text-foreground">
          {mark.name}
        </div>
        <div className="text-[12px] text-muted-foreground">
          {MEASURE_TYPE_LABELS[mark.measureType]} ·{" "}
          {mark.entries.length}{" "}
          {mark.entries.length === 1 ? "registro" : "registros"}
        </div>
      </div>
      {change ? (
        <span
          className={
            change.better ? "text-[var(--protein)]" : "text-[var(--fat)]"
          }
          aria-label={change.better ? "mejora" : "baja"}
        >
          {change.better === (mark.measureType !== "time") ? (
            <TrendingUp className="size-4" aria-hidden />
          ) : (
            <TrendingDown className="size-4" aria-hidden />
          )}
        </span>
      ) : null}
      <div className="shrink-0 text-right">
        <div className="num text-[15px] font-semibold text-foreground">
          {latest
            ? formatMarkValue(mark.measureType, latest.value, mark.unit)
            : "—"}
        </div>
        <div className="text-[11px] text-muted-foreground">última</div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}
