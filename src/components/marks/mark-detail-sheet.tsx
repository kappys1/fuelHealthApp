"use client";

import {
  Pencil,
  Plus,
  RotateCcw,
  TrendingDown,
  TrendingUp,
  Trash2,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MarkChart } from "@/components/charts/mark-chart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { labelForKey } from "@/lib/dates";
import {
  bestEntry,
  type DoubleReference,
  doubleReference,
  formatMarkValue,
  formatNumber,
  hasPercentCalculator,
  latestChange,
  latestEntry,
  markValueToInput,
  parseMarkValue,
  percentOf,
  sortEntriesAsc,
} from "@/lib/marks";
import type { MarkDTO, MarkEntryDTO } from "@/server/db/queries/marks";
import { MarkValueInput } from "./mark-value-input";

/*
  Sheet de detalle de una marca (F03 · único, reusado por Plan·Entrenos y el carril
  del Historial). Gráfica de progresión + calculadora de % (solo peso) + lista de
  entradas (editar/borrar). Editar = optimista instantáneo; borrar = optimista con
  undo (lo gestiona el owner). Borrar la marca entera pide confirmación (07).
*/
export function MarkDetailSheet({
  mark,
  today,
  onAddEntry,
  onUpdateEntry,
  onDeleteEntry,
  onRestoreEntry,
  onDeleteMark,
  onClose,
}: {
  mark: MarkDTO;
  today: string;
  onAddEntry: (
    markId: number,
    entry: { value: number; recordedOn: string; note: string | null },
  ) => Promise<void>;
  onUpdateEntry: (
    markId: number,
    entryId: number,
    patch: { value: number; recordedOn: string; note: string | null },
  ) => Promise<void>;
  onDeleteEntry: (markId: number, entry: MarkEntryDTO) => void;
  onRestoreEntry: (markId: number, entry: MarkEntryDTO) => void;
  onDeleteMark: (markId: number) => Promise<void>;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Undo INLINE (dentro del sheet): un toast de Sonner se renderiza fuera del sheet
  // modal y no recibe clics (react-remove-scroll). El registro recién borrado se
  // guarda aquí para ofrecer «Deshacer» durante 6 s dentro del propio sheet.
  const [justDeleted, setJustDeleted] = useState<MarkEntryDTO | null>(null);

  // Sin auto-desaparición: en móvil un target que se esfuma antes de acertar a
  // tocarlo es peor. El aviso se mantiene hasta que deshaces o lo descartas (×).
  const handleDelete = (entry: MarkEntryDTO) => {
    onDeleteEntry(mark.id, entry);
    setJustDeleted(entry);
  };

  const handleUndo = () => {
    if (!justDeleted) return;
    onRestoreEntry(mark.id, justDeleted);
    setJustDeleted(null);
  };

  const asc = sortEntriesAsc(mark.entries);
  const desc = [...asc].reverse();
  const best = bestEntry(mark.measureType, mark.entries);
  const latest = latestEntry(mark.entries);
  const change = latestChange(mark.measureType, mark.entries);

  const deleteMark = async () => {
    if (
      !window.confirm(
        `¿Borrar la marca «${mark.name}» y sus ${mark.entries.length} registros? No se puede deshacer.`,
      )
    )
      return;
    try {
      await onDeleteMark(mark.id);
      toast.success("Marca borrada.");
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle className="flex items-center justify-between gap-2 pr-6">
            <span className="min-w-0 truncate">{mark.name}</span>
            <button
              type="button"
              onClick={deleteMark}
              aria-label="Borrar marca"
              className="shrink-0 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Titular: última + indicador de cambio vs la vez anterior */}
          <div className="flex items-baseline justify-between gap-2">
            <div>
              <div className="num text-[28px] font-bold leading-none" style={{ fontFamily: "var(--font-display)" }}>
                {latest ? formatMarkValue(mark.measureType, latest.value, mark.unit) : "—"}
              </div>
              <div className="mt-1 text-[11.5px] text-muted-foreground">
                última{latest ? ` · ${labelForKey(latest.recordedOn)}` : ""}
              </div>
            </div>
            {change ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-semibold ${
                  change.better
                    ? "bg-[color-mix(in_srgb,var(--protein)_16%,transparent)] text-[var(--protein)]"
                    : "bg-[color-mix(in_srgb,var(--fat)_16%,transparent)] text-[var(--fat)]"
                }`}
              >
                {change.better ? (
                  mark.measureType === "time" ? (
                    <TrendingDown className="size-3.5" aria-hidden />
                  ) : (
                    <TrendingUp className="size-3.5" aria-hidden />
                  )
                ) : mark.measureType === "time" ? (
                  <TrendingUp className="size-3.5" aria-hidden />
                ) : (
                  <TrendingDown className="size-3.5" aria-hidden />
                )}
                {change.better ? "mejora" : "baja"} vs. anterior
              </span>
            ) : null}
          </div>

          {/* Gráfica de progresión (récord marcado) */}
          <MarkChart
            measureType={mark.measureType}
            unit={mark.unit}
            entries={asc}
            bestId={best?.id ?? null}
          />
          {best && latest && best.id !== latest.id ? (
            <p className="-mt-2 text-[11.5px] text-muted-foreground">
              Récord: {formatMarkValue(mark.measureType, best.value, mark.unit)} ·{" "}
              {labelForKey(best.recordedOn)}
            </p>
          ) : null}

          {/* Calculadora de % (solo marcas de peso, determinista). Doble referencia
              (F04): última (vigente, primaria) y récord; una línea si coinciden. */}
          {hasPercentCalculator(mark.measureType) ? (
            (() => {
              const refs = doubleReference(mark.measureType, mark.entries);
              return refs ? (
                <PercentCalculator refs={refs} unit={mark.unit} />
              ) : null;
            })()
          ) : null}

          {/* Entradas */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <h3 className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                Registros ({mark.entries.length})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setAdding((v) => !v);
                  setEditingId(null);
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[12px] text-primary"
              >
                <Plus className="size-3.5" aria-hidden /> Registro
              </button>
            </div>

            {justDeleted ? (
              <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-2 py-1.5 pl-3 pr-1.5">
                <span className="text-[13px] text-muted-foreground">
                  Registro eliminado
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleUndo}
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
                  >
                    <RotateCcw className="size-4" aria-hidden /> Deshacer
                  </button>
                  <button
                    type="button"
                    onClick={() => setJustDeleted(null)}
                    aria-label="Descartar"
                    className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            ) : null}

            {adding ? (
              <EntryForm
                measureType={mark.measureType}
                unit={mark.unit}
                today={today}
                onSave={async (patch) => {
                  await onAddEntry(mark.id, patch);
                  setAdding(false);
                }}
                onCancel={() => setAdding(false)}
              />
            ) : null}

            <div className="divide-y divide-line">
              {desc.map((e) =>
                editingId === e.id ? (
                  <EntryForm
                    key={e.id}
                    measureType={mark.measureType}
                    unit={mark.unit}
                    today={today}
                    entry={e}
                    onSave={async (patch) => {
                      await onUpdateEntry(mark.id, e.id, patch);
                      setEditingId(null);
                    }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div key={e.id} className="flex items-center gap-2 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="num text-[14px]">
                        {formatMarkValue(mark.measureType, e.value, mark.unit)}
                        {best?.id === e.id ? (
                          <span className="ml-1.5 text-[10.5px] font-bold text-[var(--protein)]">
                            récord
                          </span>
                        ) : null}
                      </div>
                      <div className="num text-[11.5px] text-muted-foreground">
                        {labelForKey(e.recordedOn)}
                        {e.note ? ` · ${e.note}` : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label="Editar registro"
                      onClick={() => {
                        setEditingId(e.id);
                        setAdding(false);
                      }}
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Borrar registro"
                      onClick={() => handleDelete(e)}
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                ),
              )}
              {mark.entries.length === 0 && !adding ? (
                <p className="py-3 text-[12px] text-muted-foreground">
                  Sin registros. Usa «Registro» para añadir el primero.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PercentCalculator({
  refs,
  unit,
}: {
  refs: DoubleReference;
  unit: string;
}) {
  const [pct, setPct] = useState("85");
  const p = Number(pct.replace(",", "."));
  const valid = Number.isFinite(p) && p >= 0;
  const fmt = (v: number) => `${formatNumber(v)} ${unit}`;

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
          Calculadora de %
        </span>
        <div className="flex items-center gap-1 rounded-lg border border-input bg-surface px-3">
          <input
            value={pct}
            onChange={(e) => setPct(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            inputMode="decimal"
            aria-label="Porcentaje"
            className="num h-10 w-12 bg-transparent text-right text-base outline-none"
          />
          <span className="text-[13px] text-muted-foreground">%</span>
        </div>
      </div>

      {/* Última (vigente) = referencia primaria y destacada. */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-muted-foreground">
          de tu última{" "}
          <span className="num text-foreground">{fmt(refs.last)}</span>
        </span>
        <span
          className="num text-[20px] font-bold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {valid ? fmt(percentOf(refs.last, p)) : "—"}
        </span>
      </div>

      {/* Récord = referencia secundaria, solo si difiere de la última. */}
      {refs.distinct ? (
        <div className="mt-1.5 flex items-baseline justify-between gap-2 border-t border-line pt-1.5">
          <span className="text-[12px] text-muted-foreground">
            de tu récord{" "}
            <span className="num text-foreground">{fmt(refs.record)}</span>
          </span>
          <span className="num text-[15px] font-semibold text-muted-foreground">
            {valid ? fmt(percentOf(refs.record, p)) : "—"}
          </span>
        </div>
      ) : null}

      <p className="mt-2 text-[11px] text-muted-foreground">
        {refs.distinct
          ? "La última es tu marca vigente; el récord es solo referencia. La responsabilidad del % es tuya."
          : "Sobre tu marca vigente (última). La responsabilidad del % es tuya."}
      </p>
    </div>
  );
}

function EntryForm({
  measureType,
  unit,
  today,
  entry,
  onSave,
  onCancel,
}: {
  measureType: MarkDTO["measureType"];
  unit: string;
  today: string;
  entry?: MarkEntryDTO;
  onSave: (patch: {
    value: number;
    recordedOn: string;
    note: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [valueStr, setValueStr] = useState(
    entry ? markValueToInput(measureType, entry.value) : "",
  );
  const [date, setDate] = useState(entry?.recordedOn ?? today);
  const [note, setNote] = useState(entry?.note ?? "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const value = parseMarkValue(measureType, valueStr);
    if (value == null) {
      toast.error(
        measureType === "time" ? "Valor inválido (usa mm:ss)." : "Valor inválido.",
      );
      return;
    }
    setBusy(true);
    try {
      await onSave({ value, recordedOn: date, note: note.trim() || null });
      toast.success(entry ? "Registro actualizado." : "Registro añadido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 rounded-lg bg-surface-2/60 p-3">
      <MarkValueInput
        measureType={measureType}
        unit={unit}
        value={valueStr}
        onChange={setValueStr}
        autoFocus
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="num h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
          aria-label="Fecha"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Nota (opcional)"
          className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
          aria-label="Nota"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {entry ? "Guardar" : "Añadir"}
        </button>
      </div>
    </div>
  );
}
