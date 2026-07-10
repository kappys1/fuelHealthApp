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
import { SESSIONS, WEEKDAY_LABELS } from "@/lib/macros";

const DAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** Editor del mapeo día-semana → sesión (09 §5). Precarga el check-in matinal. */
export function SessionMapEditor({ initial }: { initial: Record<string, string> }) {
  const [map, setMap] = useState<Record<string, string>>(initial);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.saveSessionMap(map);
      setMap(res.map);
      toast.success("Mapeo de sesiones guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {DAYS.map((d) => (
        <div key={d} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-[13px] text-foreground">
            {WEEKDAY_LABELS[d]}
          </span>
          <Select
            value={map[d] ?? "Descanso"}
            onValueChange={(v) => setMap((m) => ({ ...m, [d]: v }))}
          >
            <SelectTrigger className="h-9 flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
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
        className="mt-2 w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar mapeo"}
      </button>
    </div>
  );
}
