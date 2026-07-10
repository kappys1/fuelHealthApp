"use client";

import type { EntryInput } from "@/lib/client-api";
import type { MealKey } from "@/lib/macros";

// Repostaje rápido de competición (07 §4 / 09 §5b): chips de 1 toque para
// registrar entre WODs con las pulsaciones a 160.
const REFUEL: { name: string; kcal: number; prot: number; carb: number; fat: number }[] = [
  { name: "Plátano", kcal: 100, prot: 1, carb: 24, fat: 0.3 },
  { name: "Zumo 200 ml", kcal: 90, prot: 0.5, carb: 21, fat: 0.2 },
  { name: "Bebida deportiva 500 ml", kcal: 140, prot: 0, carb: 35, fat: 0 },
  { name: "Gel", kcal: 100, prot: 0, carb: 25, fat: 0 },
];

export function CompeticionRefuel({
  meal,
  onAdd,
}: {
  meal: MealKey;
  onAdd: (entries: EntryInput[]) => void;
}) {
  return (
    <section className="rounded-xl border border-primary/30 bg-primary/5 p-3">
      <h2 className="mb-2 text-[12px] font-medium text-primary">
        Repostaje rápido (competición)
      </h2>
      <div className="flex flex-wrap gap-2">
        {REFUEL.map((r) => (
          <button
            key={r.name}
            type="button"
            onClick={() => onAdd([{ meal, source: "manual", ...r }])}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px]"
          >
            <span>{r.name}</span>
            <span className="num text-muted-foreground">{r.kcal}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
