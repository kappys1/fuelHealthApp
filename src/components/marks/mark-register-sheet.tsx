"use client";

import { useId, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  canonicalizeFamily,
  DEFAULT_UNIT,
  MEASURE_TYPE_LABELS,
  MEASURE_TYPES,
  type MeasureType,
  parseMarkValue,
  uniqueFamilies,
} from "@/lib/marks";
import type { MarkDTO } from "@/server/db/queries/marks";
import { FamilyPicker } from "./family-picker";
import { MarkValueInput } from "./mark-value-input";

/*
  Sheet de registro (F03 · 09 §6). Dos usos con el mismo componente:
  - «＋ Marca» (sin presetMark): nombre libre con autocompletado de marcas
    existentes; si el nombre coincide con una, añade entrada a esa; si es nuevo,
    pide tipo de medida + unidad y crea la marca con su primera entrada.
  - «＋ entrada» desde el detalle (con presetMark): nombre y tipo fijados.
  Fecha por defecto = hoy (Europe/Madrid vía lib/dates).
*/
export function MarkRegisterSheet({
  existingMarks,
  presetMark,
  today,
  onCreateMark,
  onAddEntry,
  onClose,
}: {
  existingMarks: MarkDTO[];
  presetMark?: MarkDTO;
  today: string;
  onCreateMark: (
    mark: {
      name: string;
      measureType: MeasureType;
      unit: string;
      family?: string | null;
    },
    entry: { value: number; recordedOn: string; note: string | null },
  ) => Promise<void>;
  onAddEntry: (
    markId: number,
    entry: { value: number; recordedOn: string; note: string | null },
  ) => Promise<void>;
  onClose: () => void;
}) {
  const listId = useId();
  const [name, setName] = useState(presetMark?.name ?? "");
  const [measureType, setMeasureType] = useState<MeasureType>(
    presetMark?.measureType ?? "weight",
  );
  const [unit, setUnit] = useState(presetMark?.unit ?? DEFAULT_UNIT.weight);
  const [family, setFamily] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  // Familias existentes (únicas, no vacías) para los chips del FamilyPicker.
  const families = useMemo(() => uniqueFamilies(existingMarks), [existingMarks]);

  // Marca existente que coincide por nombre (case-insensitive) — determina si
  // añadimos entrada a una marca o creamos una nueva.
  const matched = useMemo(() => {
    if (presetMark) return presetMark;
    const key = name.trim().toLowerCase();
    if (!key) return null;
    return existingMarks.find((m) => m.name.trim().toLowerCase() === key) ?? null;
  }, [presetMark, name, existingMarks]);

  const isNew = !matched && name.trim() !== "";
  const effType = matched?.measureType ?? measureType;
  const effUnit = matched?.unit ?? unit;

  const changeType = (t: MeasureType) => {
    // Al cambiar de tipo, sugiere su unidad por defecto (si no la tocaste).
    if (unit === "" || (MEASURE_TYPES as readonly string[]).some((k) => unit === DEFAULT_UNIT[k as MeasureType])) {
      setUnit(DEFAULT_UNIT[t]);
    }
    setMeasureType(t);
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("Escribe el nombre de la marca.");
      return;
    }
    if (isNew && !effUnit.trim()) {
      toast.error("Indica la unidad de la marca.");
      return;
    }
    const value = parseMarkValue(effType, valueStr);
    if (value == null) {
      toast.error(
        effType === "time" ? "Valor inválido (usa mm:ss)." : "Valor inválido.",
      );
      return;
    }
    const entry = { value, recordedOn: date, note: note.trim() || null };
    setBusy(true);
    try {
      if (matched) {
        await onAddEntry(matched.id, entry);
        toast.success("Registro añadido.");
      } else {
        await onCreateMark(
          {
            name: name.trim(),
            measureType: effType,
            unit: effUnit.trim(),
            family: canonicalizeFamily(family, families),
          },
          entry,
        );
        toast.success("Marca creada.");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle>
            {presetMark
              ? `Añadir registro · ${presetMark.name}`
              : "Añadir marca o registro"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3 px-4 pb-8">
          {/* Nombre (autocompleta de marcas existentes) */}
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Marca
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!!presetMark}
              list={presetMark ? undefined : listId}
              placeholder="Sentadilla 1RM, Fran, 5k…"
              className="w-full rounded-lg border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring disabled:opacity-70"
              aria-label="Nombre de la marca"
            />
            {!presetMark ? (
              <datalist id={listId}>
                {existingMarks.map((m) => (
                  <option key={m.id} value={m.name} />
                ))}
              </datalist>
            ) : null}
            {matched && !presetMark ? (
              <p className="mt-1 text-[11.5px] text-muted-foreground">
                Añadirás un registro a «{matched.name}» ·{" "}
                {MEASURE_TYPE_LABELS[matched.measureType]}
                {matched.measureType !== "time" ? ` (${matched.unit})` : ""}.
              </p>
            ) : null}
          </label>

          {/* Tipo + unidad: solo al crear una marca nueva */}
          {isNew ? (
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-[12px] text-muted-foreground">
                  Tipo de medida
                </span>
                <Select value={measureType} onValueChange={(v) => changeType(v as MeasureType)}>
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASURE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {MEASURE_TYPE_LABELS[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="block">
                <span className="mb-1 block text-[12px] text-muted-foreground">
                  Unidad{measureType === "time" ? " (tiempo = mm:ss)" : ""}
                </span>
                <input
                  value={measureType === "time" ? "mm:ss" : unit}
                  onChange={(e) => setUnit(e.target.value)}
                  disabled={measureType === "time"}
                  placeholder="kg, reps, km…"
                  className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring disabled:opacity-70"
                  aria-label="Unidad"
                />
              </label>
            </div>
          ) : null}

          {/* Familia (opcional): chips tocables + texto libre (F11). Solo al crear
              una marca nueva; se captura ahora para el filtro/agrupación futuros. */}
          {isNew ? (
            <div className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                Familia (opcional)
              </span>
              <FamilyPicker
                value={family}
                onChange={setFamily}
                families={families}
              />
            </div>
          ) : null}

          {/* Valor */}
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Valor
            </span>
            <MarkValueInput
              measureType={effType}
              unit={effUnit}
              value={valueStr}
              onChange={setValueStr}
              autoFocus={!!presetMark}
            />
          </label>

          {/* Fecha + nota */}
          <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                Fecha
              </span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="num h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
                aria-label="Fecha"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                Nota (opcional)
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="RPE 8, con cinturón…"
                className="h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
                aria-label="Nota"
              />
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {busy ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
