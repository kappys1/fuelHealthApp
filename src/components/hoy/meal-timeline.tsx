"use client";

import { Check, ChevronDown, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { MealRow } from "@/components/hoy/meal-row";
import { QuickAddMenu } from "@/components/hoy/quick-add-menu";
import {
  displayMacro,
  type MealKey,
  MEAL_LABELS,
  roundKcal,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import { subtotalsByMeal } from "@/server/analytics/dayTotals";
import type { EntryDTO } from "@/server/db/queries/day";
import type { TemplateDTO } from "@/server/db/queries/lookups";
import type { BloatEventDTO } from "@/server/db/queries/bloat";

const SECTIONS: MealKey[] = ["almuerzo", "comida", "merienda", "cena"];

function markerAnchor(time: string): MealKey {
  const hour = Number(time.slice(0, 2));
  if (hour < 13) return "almuerzo";
  if (hour < 17) return "comida";
  if (hour < 21) return "merienda";
  return "cena";
}

export function MealTimeline({
  entries,
  templates,
  bloatEvents,
  onSaveEntry,
  onDeleteEntry,
  onCopyYesterday,
  onSaveTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onEditBloat,
}: {
  entries: EntryDTO[];
  templates: TemplateDTO[];
  bloatEvents: BloatEventDTO[];
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
  onEditBloat: (event: BloatEventDTO) => void;
}) {
  const subtotals = subtotalsByMeal(entries);
  const extras = entries.filter((entry) => entry.meal === "extra");
  const sections: MealKey[] = extras.length > 0 ? [...SECTIONS, "extra"] : SECTIONS;
  const [expanded, setExpanded] = useState<Set<MealKey>>(() => {
    const first = sections.find((meal) => entries.some((entry) => entry.meal === meal));
    return new Set(first ? [first] : []);
  });

  const markers = useMemo(() => {
    const grouped = new Map<MealKey, BloatEventDTO[]>();
    for (const event of bloatEvents) {
      const anchor = markerAnchor(event.occurredAt);
      grouped.set(anchor, [...(grouped.get(anchor) ?? []), event]);
    }
    return grouped;
  }, [bloatEvents]);

  const moments = new Set(entries.map((entry) => entry.meal)).size;
  const allExpanded = sections.every((meal) => expanded.has(meal));
  const toggleAll = () =>
    setExpanded(allExpanded ? new Set() : new Set(sections));

  return (
    <section aria-labelledby="meals-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="meals-title" className="section-title">Comidas</h2>
          <p className="section-copy">
            {entries.length} {entries.length === 1 ? "entrada" : "entradas"} · {moments}{" "}
            {moments === 1 ? "momento" : "momentos"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleAll}
            className="min-h-11 rounded-lg px-2.5 text-[12px] font-semibold text-primary"
          >
            {allExpanded ? "Contraer" : "Expandir"}
          </button>
          <QuickAddMenu
            templates={templates}
            onCopyYesterday={onCopyYesterday}
            onSaveTemplate={onSaveTemplate}
            onApplyTemplate={onApplyTemplate}
            onDeleteTemplate={onDeleteTemplate}
          />
        </div>
      </div>

      <div className="wellness-card overflow-hidden">
        {sections.map((meal) => {
          const rows = entries.filter((entry) => entry.meal === meal);
          const open = expanded.has(meal);
          const mealMarkers = markers.get(meal) ?? [];
          return (
            <div key={meal} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() =>
                  setExpanded((current) => {
                    const next = new Set(current);
                    if (next.has(meal)) next.delete(meal);
                    else next.add(meal);
                    return next;
                  })
                }
                className="flex min-h-[74px] w-full items-center gap-3 px-[18px] py-3 text-left"
                aria-expanded={open}
              >
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-full border",
                    rows.length > 0
                      ? "border-protein bg-protein text-white dark:text-background"
                      : "border-line-strong bg-surface-2 text-muted-foreground",
                  )}
                >
                  {rows.length > 0 ? <Check className="size-4" aria-hidden /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-[15px] font-semibold text-foreground">
                    {MEAL_LABELS[meal]}
                  </strong>
                  <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                    {rows.length > 0
                      ? `${rows.length} ${rows.length === 1 ? "alimento registrado" : "alimentos registrados"}`
                      : "Sin registros"}
                  </span>
                </span>
                <span className="shrink-0 font-display text-[17px] font-semibold tabular-nums text-foreground">
                  {roundKcal(subtotals[meal].kcal)}
                  <small className="ml-1 text-[10px] font-normal text-muted-foreground">kcal</small>
                </span>
                <ChevronDown
                  className={cn(
                    "size-4 shrink-0 text-muted-foreground transition-transform",
                    open && "rotate-180",
                  )}
                  aria-hidden
                />
              </button>

              {open && rows.length > 0 ? (
                <div className="border-t border-line bg-surface-2/55 px-[18px] py-2">
                  {rows.map((entry) => (
                    <MealRow
                      key={entry.id}
                      entry={entry}
                      onSave={(patch) => onSaveEntry(entry.id, patch)}
                      onDelete={onDeleteEntry}
                    />
                  ))}
                  <p className="border-t border-line py-2 text-[11px] text-muted-foreground">
                    {displayMacro(subtotals[meal].prot)} P ·{" "}
                    {displayMacro(subtotals[meal].carb)} C ·{" "}
                    {displayMacro(subtotals[meal].fat)} F
                  </p>
                </div>
              ) : null}

              {mealMarkers.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => onEditBloat(event)}
                  className="flex min-h-[58px] w-full items-center gap-3 border-t border-dashed border-primary/25 bg-primary-soft px-[18px] py-2.5 text-left"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface text-special">
                    <Waves className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[13px] font-semibold text-foreground">
                      Hinchazón {event.severity}
                    </strong>
                  </span>
                  <time className="font-display text-[12px] tabular-nums text-muted-foreground">
                    {event.occurredAt.slice(0, 5)}
                  </time>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}
