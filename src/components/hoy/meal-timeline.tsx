"use client";

import { Check, ChevronDown, Plus } from "lucide-react";
import { useState } from "react";
import { MealRow } from "@/components/hoy/meal-row";
import { QuickAddMenu } from "@/components/hoy/quick-add-menu";
import { type MealKey, MEAL_LABELS, roundKcal } from "@/lib/macros";
import { subtotalsByMeal } from "@/server/analytics/dayTotals";
import type { EntryDTO } from "@/server/db/queries/day";
import type { TemplateDTO } from "@/server/db/queries/lookups";
import { cn } from "@/lib/utils";

const SECTIONS: MealKey[] = ["almuerzo", "comida", "merienda", "cena"];

type SaveEntry = (
  id: number,
  patch: {
    meal: MealKey;
    name: string;
    kcal: number;
    prot: number;
    carb: number;
    fat: number;
  },
) => void;

export function MealTimeline({
  entries,
  templates,
  onAddToMeal,
  onSaveEntry,
  onDeleteEntry,
  onCopyYesterday,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
}: {
  entries: EntryDTO[];
  templates: TemplateDTO[];
  onAddToMeal: (meal: MealKey) => void;
  onSaveEntry: SaveEntry;
  onDeleteEntry: (entry: EntryDTO) => void;
  onCopyYesterday: () => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (id: number) => void;
  onDeleteTemplate: (id: number) => void;
}) {
  const subtotals = subtotalsByMeal(entries);
  const extras = entries.filter((e) => e.meal === "extra");
  const sections: MealKey[] = extras.length > 0 ? [...SECTIONS, "extra"] : SECTIONS;
  const doneCount = sections.filter(
    (m) => entries.some((e) => e.meal === m),
  ).length;

  return (
    <section className="rounded-[18px] border border-line bg-surface shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div>
          <h2 className="card-title text-muted-foreground">Comidas</h2>
          <p className="mt-0.5 num text-[12px] text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entrada" : "entradas"} ·{" "}
            {doneCount} {doneCount === 1 ? "comida" : "comidas"}
          </p>
        </div>
        <QuickAddMenu
          templates={templates}
          onCopyYesterday={onCopyYesterday}
          onSaveTemplate={onSaveTemplate}
          onApplyTemplate={onApplyTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      </div>

      <div className="divide-y divide-line">
        {sections.map((meal) => (
          <MealItem
            key={meal}
            meal={meal}
            rows={entries.filter((e) => e.meal === meal)}
            kcal={subtotals[meal].kcal}
            onAdd={onAddToMeal}
            onSaveEntry={onSaveEntry}
            onDelete={onDeleteEntry}
          />
        ))}
      </div>
    </section>
  );
}

function MealItem({
  meal,
  rows,
  kcal,
  onAdd,
  onSaveEntry,
  onDelete,
}: {
  meal: MealKey;
  rows: EntryDTO[];
  kcal: number;
  onAdd: (meal: MealKey) => void;
  onSaveEntry: SaveEntry;
  onDelete: (entry: EntryDTO) => void;
}) {
  const done = rows.length > 0;
  // Colapsable (patrón mockup): resuelve los días largos (9+ entradas). Las comidas
  // registradas arrancan abiertas (ver la comida es el caso común); las vacías,
  // cerradas. El `+` y la edición en línea (MealRow) se preservan intactos.
  const [open, setOpen] = useState(done);

  return (
    <article>
      <div className="flex items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-full",
              done
                ? "bg-protein/15 text-protein"
                : "border border-line text-muted-foreground",
            )}
          >
            {done ? (
              <Check className="size-4" aria-hidden />
            ) : (
              <span className="size-1.5 rounded-full bg-current" aria-hidden />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-foreground">
              {MEAL_LABELS[meal]}
            </span>
            <span className="block text-[12px] text-muted-foreground">
              {done
                ? `${rows.length} ${rows.length === 1 ? "entrada" : "entradas"}`
                : "sin registrar"}
            </span>
          </span>
          {done ? (
            <span className="num shrink-0 text-[13px] font-semibold text-foreground">
              {roundKcal(kcal)} kcal
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </button>
        <button
          type="button"
          aria-label={`Añadir a ${MEAL_LABELS[meal]}`}
          onClick={() => onAdd(meal)}
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-primary"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="px-4 pb-2">
          {done ? (
            rows.map((e) => (
              <MealRow
                key={e.id}
                entry={e}
                onSave={(patch) => onSaveEntry(e.id, patch)}
                onDelete={onDelete}
              />
            ))
          ) : (
            <button
              type="button"
              onClick={() => onAdd(meal)}
              className="w-full rounded-lg border border-dashed border-line py-2 text-[12px] text-muted-foreground"
            >
              Toca para añadir a {MEAL_LABELS[meal].toLowerCase()}
            </button>
          )}
        </div>
      ) : null}
    </article>
  );
}
