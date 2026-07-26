"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { WEEKDAY_LABELS } from "@/lib/macros";
import {
  type TrainingByWeekday,
  type TrainingSlot,
} from "@/lib/training-slot";

const DAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** Editor del mapeo día-semana → sesión (09 §5). Precarga el check-in matinal. */
export function SessionMapEditor({
  initial,
  reviewed: initialReviewed,
}: {
  initial: TrainingByWeekday;
  reviewed: boolean;
}) {
  const [map, setMap] = useState<TrainingByWeekday>(initial);
  const [reviewed, setReviewed] = useState(initialReviewed);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.saveSessionMap(map);
      setMap(res.map);
      setReviewed(res.reviewed);
      toast.success("Días de entreno guardados.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      {!reviewed ? (
        <p
          className="rounded-xl bg-carbs-soft px-3 py-2 text-[13px] text-foreground"
          role="status"
        >
          Revisa tus franjas, sobre todo el sábado.
        </p>
      ) : null}
      {DAYS.map((d) => (
        <div
          key={d}
          className="grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] items-center gap-3"
        >
          <span className="text-[13px] font-medium text-foreground">
            {WEEKDAY_LABELS[d]}
          </span>
          <Select
            value={map[d] ?? "descanso"}
            onValueChange={(v) =>
              setMap((m) => ({ ...m, [d]: v as TrainingSlot }))
            }
          >
            <SelectTrigger className="h-11 w-full min-w-0 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["mañana", "tarde", "descanso"] as const).map((slot) => (
                <SelectItem key={slot} value={slot} className="min-h-11 text-base">
                  {slot[0]!.toUpperCase() + slot.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar patrón"}
      </button>
    </div>
  );
}
