"use client";

import { BookmarkPlus, Copy, Trash2 } from "lucide-react";
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
  effectiveBase,
  formatQuantity,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  PRODUCT_UNIT_NOUN,
  PRODUCT_UNIT_SUFFIX,
  scaledForStore,
} from "@/lib/macros";
import type { EntryDTO } from "@/server/db/queries/day";

const numberFromInput = (value: string) =>
  value === "" ? 0 : Number(value.replace(",", "."));

// Patch del editor de entrada. La base (baseG/base*) solo viaja cuando la entrada
// es escalable (F14·A): al guardar el caso 2 persiste la base derivada («sanado»).
export type EntryEditPatch = {
  meal: MealKey;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
  grams?: number | null;
  baseG?: number | null;
  baseKcal?: number | null;
  baseProt?: number | null;
  baseCarb?: number | null;
  baseFat?: number | null;
};

export function MealRow({
  entry,
  onSave,
  onDelete,
  onDuplicate,
  onDuplicateToToday,
  onSaveProduct,
  isPastDay,
}: {
  entry: EntryDTO;
  onSave: (patch: EntryEditPatch) => void;
  onDelete: (entry: EntryDTO) => void;
  onDuplicate: (entry: EntryDTO) => void;
  onDuplicateToToday: (entry: EntryDTO) => void;
  onSaveProduct: (entry: EntryDTO) => void;
  isPastDay: boolean;
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
              {entry.grams != null ? `${formatQuantity(entry.grams, entry.unit)} · ` : ""}
              {entry.kcal} kcal · {displayMacro(entry.prot)}P/{displayMacro(entry.carb)}C/
              {displayMacro(entry.fat)}F
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(entry)}
          aria-label={`Borrar ${entry.name}`}
          className="grid size-11 shrink-0 place-items-center rounded-lg bg-transparent text-muted-foreground transition-colors hover:bg-surface hover:text-destructive focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        >
          <Trash2 className="size-4" aria-hidden />
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
            isPastDay={isPastDay}
            onCancel={() => setOpen(false)}
            onSave={(patch) => {
              onSave(patch);
              setOpen(false);
            }}
            onDuplicate={() => {
              onDuplicate(entry);
              setOpen(false);
            }}
            onDuplicateToToday={() => {
              onDuplicateToToday(entry);
              setOpen(false);
            }}
            onSaveProduct={() => {
              onSaveProduct(entry);
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
  isPastDay,
  onCancel,
  onSave,
  onDuplicate,
  onDuplicateToToday,
  onSaveProduct,
}: {
  entry: EntryDTO;
  isPastDay: boolean;
  onCancel: () => void;
  onSave: (patch: EntryEditPatch) => void;
  onDuplicate: () => void;
  onDuplicateToToday: () => void;
  onSaveProduct: () => void;
}) {
  const [name, setName] = useState(entry.name);
  const [meal, setMeal] = useState<MealKey>(entry.meal);
  // Base efectiva (F14·A): caso 1 = base guardada; caso 2 = macros actuales a
  // baseG=grams (derivada); caso 3 = null → solo-macros, sin stepper.
  const eff = effectiveBase(entry);
  const scalable = eff != null;
  const [nutrition, setNutrition] = useState(() => ({
    grams: String(entry.grams ?? eff?.baseG ?? ""),
    kcal: String(entry.kcal),
    prot: String(entry.prot),
    carb: String(entry.carb),
    fat: String(entry.fat),
  }));
  const { grams, kcal, prot, carb, fat } = nutrition;
  const onGrams = (value: string) => {
    if (!eff) {
      setNutrition((current) => ({ ...current, grams: value }));
      return;
    }
    const scaled = scaledForStore(eff.base, numberFromInput(value), eff.baseG);
    setNutrition({
      grams: value,
      kcal: String(scaled.kcal),
      prot: String(scaled.prot),
      carb: String(scaled.carb),
      fat: String(scaled.fat),
    });
  };
  const setNutritionField =
    (field: "kcal" | "prot" | "carb" | "fat") => (value: string) =>
      setNutrition((current) => ({ ...current, [field]: value }));

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
          <Stepper
            value={grams}
            onChange={onGrams}
            step={10}
            suffix={PRODUCT_UNIT_SUFFIX[entry.unit]}
            ariaLabel={`Cantidad en ${PRODUCT_UNIT_NOUN[entry.unit]}`}
          />
        </label>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <LabeledStepper
          label="kcal"
          value={kcal}
          onChange={setNutritionField("kcal")}
          step={10}
        />
        <LabeledStepper
          label="Proteína"
          value={prot}
          onChange={setNutritionField("prot")}
          step={1}
        />
        <LabeledStepper
          label="Hidratos"
          value={carb}
          onChange={setNutritionField("carb")}
          step={1}
        />
        <LabeledStepper
          label="Grasa"
          value={fat}
          onChange={setNutritionField("fat")}
          step={1}
        />
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
              // Escalable → persistir cantidad + base efectiva. En el caso 2 esto
              // «sana» la entrada (queda como caso 1 nativo, AC A3); en el caso 1
              // reescribe la misma base (idempotente).
              ...(eff
                ? {
                    grams: Math.round(numberFromInput(grams)),
                    baseG: eff.baseG,
                    baseKcal: eff.base.kcal,
                    baseProt: eff.base.prot,
                    baseCarb: eff.base.carb,
                    baseFat: eff.base.fat,
                  }
                : {}),
            })
          }
          className="min-h-11 rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground"
        >
          Guardar
        </button>
      </div>

      {/* F13 §B·C — acciones de la entrada: duplicar (idéntica, conserva base) y
          promover a «Mis productos». En día pasado, duplicar aquí o a hoy. */}
      <div className="space-y-2 border-t border-line pt-3">
        {isPastDay ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onDuplicateToToday}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-primary text-[13px] font-semibold text-primary"
            >
              <Copy className="size-4" aria-hidden />
              Duplicar a hoy
            </button>
            <button
              type="button"
              onClick={onDuplicate}
              className="min-h-11 rounded-xl border border-line-strong text-[13px] font-medium text-foreground"
            >
              Duplicar aquí
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onDuplicate}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px] font-medium text-foreground"
          >
            <Copy className="size-4" aria-hidden />
            Duplicar
          </button>
        )}
        <button
          type="button"
          onClick={onSaveProduct}
          className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-line-strong text-[13px] font-medium text-foreground"
        >
          <BookmarkPlus className="size-4" aria-hidden />
          Guardar en Mis productos
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
