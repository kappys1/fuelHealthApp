"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import {
  displayMacro,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  scaledForStore,
} from "@/lib/macros";
import type { EntryDTO } from "@/server/db/queries/day";

export function MealRow({
  entry,
  onSave,
  onDelete,
}: {
  entry: EntryDTO;
  onSave: (patch: {
    meal: MealKey;
    name: string;
    kcal: number;
    prot: number;
    carb: number;
    fat: number;
    grams?: number | null;
  }) => void;
  onDelete: (entry: EntryDTO) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <EditForm
        entry={entry}
        onCancel={() => setEditing(false)}
        onSave={(patch) => {
          onSave(patch);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-dashed border-line py-2 last:border-b-0">
      {entry.photoUrl ? (
        <Dialog>
          <DialogTrigger asChild>
            <button type="button" className="shrink-0" aria-label="Ver foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={entry.photoUrl}
                alt=""
                className="size-8 rounded-md object-cover"
              />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle className="card-title">{entry.name}</DialogTitle>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={entry.photoUrl} alt={entry.name} className="w-full rounded-lg" />
          </DialogContent>
        </Dialog>
      ) : null}

      <button
        type="button"
        onClick={() => setEditing(true)}
        className="min-w-0 flex-1 text-left"
      >
        <div className="truncate text-[14px] text-foreground">
          {entry.name}
          {entry.grams != null ? (
            <span className="text-muted-foreground"> · {entry.grams} g</span>
          ) : null}
        </div>
        <div className="num text-[12px] text-muted-foreground">
          {entry.kcal} kcal · {displayMacro(entry.prot)}P/{displayMacro(entry.carb)}C/
          {displayMacro(entry.fat)}F
        </div>
      </button>

      <button
        type="button"
        aria-label="Borrar"
        onClick={() => onDelete(entry)}
        className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
  );
}

function EditForm({
  entry,
  onCancel,
  onSave,
}: {
  entry: EntryDTO;
  onCancel: () => void;
  onSave: (patch: {
    meal: MealKey;
    name: string;
    kcal: number;
    prot: number;
    carb: number;
    fat: number;
    grams?: number | null;
  }) => void;
}) {
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState<MealKey>(entry.meal);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [prot, setProt] = useState(String(entry.prot));
  const [carb, setCarb] = useState(String(entry.carb));
  const [fat, setFat] = useState(String(entry.fat));

  // Escalable (F06): la entrada tiene base inmutable → aparece el stepper de
  // cantidad, que reescala kcal/macros SIEMPRE desde base* (nunca desde lo mostrado).
  const scalable =
    entry.baseG != null &&
    entry.baseKcal != null &&
    entry.baseProt != null &&
    entry.baseCarb != null &&
    entry.baseFat != null;
  const [grams, setGrams] = useState(String(entry.grams ?? entry.baseG ?? ""));

  const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));

  // Cambiar la cantidad reescala desde la base inmutable y pisa cualquier override
  // manual de macros (los gramos mandan — AC3). Nunca reescala sobre lo ya mostrado.
  const onGrams = (v: string) => {
    setGrams(v);
    if (!scalable) return;
    const base = {
      kcal: entry.baseKcal as number,
      prot: entry.baseProt as number,
      carb: entry.baseCarb as number,
      fat: entry.baseFat as number,
    };
    const s = scaledForStore(base, n(v), entry.baseG);
    setKcal(String(s.kcal));
    setProt(String(s.prot));
    setCarb(String(s.carb));
    setFat(String(s.fat));
  };

  return (
    <div className="space-y-2 border-b border-dashed border-line py-3 last:border-b-0">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
        aria-label="Descripción"
      />
      <div className="flex items-center gap-2">
        <Select value={meal} onValueChange={(v) => setMeal(v as MealKey)}>
          <SelectTrigger className="h-9 flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_ORDER.map((m) => (
              <SelectItem key={m} value={m}>
                {MEAL_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {scalable ? (
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">
            Cantidad
          </span>
          <Stepper
            value={grams}
            onChange={onGrams}
            step={10}
            suffix="g"
            ariaLabel="Cantidad en gramos"
          />
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <LabeledStepper label="kcal" value={kcal} onChange={setKcal} step={10} />
        <LabeledStepper label="Prot" value={prot} onChange={setProt} step={1} />
        <LabeledStepper label="Hidr" value={carb} onChange={setCarb} step={1} />
        <LabeledStepper label="Grasa" value={fat} onChange={setFat} step={1} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: name.trim() || entry.name,
              meal,
              kcal: Math.round(n(kcal)),
              prot: n(prot),
              carb: n(carb),
              fat: n(fat),
              ...(scalable ? { grams: Math.round(n(grams)) } : {}),
            })
          }
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function LabeledStepper({
  label,
  value,
  onChange,
  step,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  step: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      <Stepper value={value} onChange={onChange} step={step} ariaLabel={label} />
    </label>
  );
}
