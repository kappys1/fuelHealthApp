"use client";

import { Plus } from "lucide-react";
import { MealRow } from "@/components/hoy/meal-row";
import { QuickAddMenu } from "@/components/hoy/quick-add-menu";
import {
  type MealKey,
  MEAL_LABELS,
  roundKcal,
} from "@/lib/macros";
import { subtotalsByMeal } from "@/server/analytics/dayTotals";
import type { EntryDTO } from "@/server/db/queries/day";
import type { TemplateDTO } from "@/server/db/queries/lookups";

const SECTIONS: MealKey[] = ["almuerzo", "comida", "merienda", "cena"];

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
  onSaveEntry: (
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
  onDeleteEntry: (entry: EntryDTO) => void;
  onCopyYesterday: () => void;
  onSaveTemplate: (name: string) => void;
  onApplyTemplate: (id: number) => void;
  onDeleteTemplate: (id: number) => void;
}) {
  const subtotals = subtotalsByMeal(entries);
  const extras = entries.filter((e) => e.meal === "extra");
  const sections: MealKey[] = extras.length > 0 ? [...SECTIONS, "extra"] : SECTIONS;

  return (
    <section className="rounded-[18px] border border-line bg-surface shadow-[var(--card-shadow)]">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="card-title text-muted-foreground">Comidas</h2>
        <QuickAddMenu
          templates={templates}
          onCopyYesterday={onCopyYesterday}
          onSaveTemplate={onSaveTemplate}
          onApplyTemplate={onApplyTemplate}
          onDeleteTemplate={onDeleteTemplate}
        />
      </div>

      <div className="divide-y divide-line">
        {sections.map((meal) => {
          const rows = entries.filter((e) => e.meal === meal);
          return (
            <div key={meal} className="px-4 py-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-[13px] font-semibold text-foreground">
                    {MEAL_LABELS[meal]}
                  </h3>
                  {rows.length > 0 ? (
                    <span className="num text-[12px] text-muted-foreground">
                      {roundKcal(subtotals[meal].kcal)} kcal
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label={`Añadir a ${MEAL_LABELS[meal]}`}
                  onClick={() => onAddToMeal(meal)}
                  className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-primary"
                >
                  <Plus className="size-4" aria-hidden />
                </button>
              </div>

              {rows.length > 0 ? (
                <div className="mt-1">
                  {rows.map((e) => (
                    <MealRow
                      key={e.id}
                      entry={e}
                      onSave={(patch) => onSaveEntry(e.id, patch)}
                      onDelete={onDeleteEntry}
                    />
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <p className="border-t border-line px-4 py-2 text-[12px] text-muted-foreground">
        Toca el nombre de una comida para editarla.
      </p>
    </section>
  );
}
