"use client";

import { ChevronRight, Trash2 } from "lucide-react";
import Image from "next/image";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import {
  displayMacro,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  scaledForStore,
} from "@/lib/macros";
import type { EntryDTO } from "@/server/db/queries/day";

const numberFromInput = (value: string) =>
  value === "" ? 0 : Number(value.replace(",", "."));

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
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="flex min-h-[58px] items-center gap-2 border-b border-line py-1 last:border-b-0">
        {entry.photoUrl ? (
          <Dialog>
            <DialogTrigger asChild>
              <button
                type="button"
                className="grid size-11 shrink-0 place-items-center"
                aria-label="Ver foto"
              >
                <Image
                  src={entry.photoUrl}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="size-9 rounded-lg object-cover"
                />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogTitle className="text-[16px]">{entry.name}</DialogTitle>
              <Image
                src={entry.photoUrl}
                alt={entry.name}
                width={800}
                height={800}
                unoptimized
                className="h-auto w-full rounded-xl"
              />
            </DialogContent>
          </Dialog>
        ) : null}

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-2 text-left"
          aria-label={`Editar ${entry.name}`}
        >
          <span className="min-w-0 flex-1">
            <strong className="block truncate text-[13px] font-medium text-foreground">
              {entry.name}
            </strong>
            <span className="mt-0.5 block truncate font-display text-[11px] tabular-nums text-muted-foreground">
              {entry.grams != null ? `${entry.grams} g · ` : ""}
              {entry.kcal} kcal · {displayMacro(entry.prot)}P/{displayMacro(entry.carb)}C/
              {displayMacro(entry.fat)}F
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar entrada</SheetTitle>
            <SheetDescription>
              Cambia cantidad, macros o momento del día. La base del producto se conserva.
            </SheetDescription>
          </SheetHeader>
          <EditForm
            entry={entry}
            onCancel={() => setOpen(false)}
            onSave={(patch) => {
              onSave(patch);
              setOpen(false);
            }}
            onDelete={() => {
              onDelete(entry);
              setOpen(false);
            }}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}

function EditForm({
  entry,
  onCancel,
  onSave,
  onDelete,
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
  onDelete: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState<MealKey>(entry.meal);
  const [kcal, setKcal] = useState(String(entry.kcal));
  const [prot, setProt] = useState(String(entry.prot));
  const [carb, setCarb] = useState(String(entry.carb));
  const [fat, setFat] = useState(String(entry.fat));
  const scalable =
    entry.baseG != null &&
    entry.baseKcal != null &&
    entry.baseProt != null &&
    entry.baseCarb != null &&
    entry.baseFat != null;
  const [grams, setGrams] = useState(String(entry.grams ?? entry.baseG ?? ""));
  const onGrams = (value: string) => {
    setGrams(value);
    if (!scalable) return;
    const scaled = scaledForStore(
      {
        kcal: entry.baseKcal as number,
        prot: entry.baseProt as number,
        carb: entry.baseCarb as number,
        fat: entry.baseFat as number,
      },
      numberFromInput(value),
      entry.baseG,
    );
    setKcal(String(scaled.kcal));
    setProt(String(scaled.prot));
    setCarb(String(scaled.carb));
    setFat(String(scaled.fat));
  };

  return (
    <div className="space-y-4 px-4 pb-6">
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-muted-foreground">Descripción</span>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-[12px] text-muted-foreground">Momento</span>
        <Select value={meal} onValueChange={(value) => setMeal(value as MealKey)}>
          <SelectTrigger className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MEAL_ORDER.map((item) => (
              <SelectItem key={item} value={item}>{MEAL_LABELS[item]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      {scalable ? (
        <label className="block">
          <span className="mb-1.5 block text-[12px] text-muted-foreground">Cantidad</span>
          <Stepper value={grams} onChange={onGrams} step={10} suffix="g" ariaLabel="Cantidad en gramos" />
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <LabeledStepper label="kcal" value={kcal} onChange={setKcal} step={10} />
        <LabeledStepper label="Proteína" value={prot} onChange={setProt} step={1} />
        <LabeledStepper label="Hidratos" value={carb} onChange={setCarb} step={1} />
        <LabeledStepper label="Grasa" value={fat} onChange={setFat} step={1} />
      </div>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-line-strong text-[13px] font-medium text-foreground">
          Cancelar
        </button>
        <button
          type="button"
          onClick={() =>
            onSave({
              name: name.trim() || entry.name,
              meal,
              kcal: Math.round(numberFromInput(kcal)),
              prot: numberFromInput(prot),
              carb: numberFromInput(carb),
              fat: numberFromInput(fat),
              ...(scalable ? { grams: Math.round(numberFromInput(grams)) } : {}),
            })
          }
          className="min-h-11 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground"
        >
          Guardar
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-[13px] font-medium text-destructive"
      >
        <Trash2 className="size-4" aria-hidden /> Borrar entrada
      </button>
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
  onChange: (value: string) => void;
  step: number;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 block text-[12px] text-muted-foreground">{label}</span>
      <Stepper value={value} onChange={onChange} step={step} ariaLabel={label} />
    </label>
  );
}
