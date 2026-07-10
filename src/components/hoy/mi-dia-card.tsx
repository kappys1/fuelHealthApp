"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import {
  BLOAT_LABELS,
  type BloatKey,
  PHASE_LABELS,
  type PhaseKey,
  phaseLabel,
  SESSIONS,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { DayView } from "@/server/db/queries/day";

const NONE = "__none__";
const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];

export function MiDiaCard({
  view,
  onPatch,
}: {
  view: DayView;
  onPatch: (patch: DayPatch) => void;
}) {
  const day = view.day;
  const health = view.health;
  const hasContent =
    !!day &&
    (day.weight != null ||
      day.sessionLabel != null ||
      day.phase != null ||
      day.bloat != null ||
      day.notes != null ||
      day.waterL != null);
  const [open, setOpen] = useState(!hasContent);

  const weight = day?.weight ?? null;
  const summary = [
    day?.sessionLabel,
    phaseLabel(day?.phase),
    weight != null ? `${weight.toLocaleString("es-ES")} kg` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section className="rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <div className="card-title text-muted-foreground">Mi día</div>
          <div className="num mt-0.5 truncate text-[13px] text-foreground">
            {summary || "Sin datos del día — toca para rellenar"}
          </div>
        </div>
        {open ? (
          <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
      </button>

      {open ? (
        <div className="space-y-4 border-t border-line px-4 py-4">
          {/* Peso + agua */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">
                Peso (kg, ayunas)
              </span>
              <Stepper
                value={weight != null ? String(weight) : ""}
                onChange={(v) =>
                  onPatch({ weight: v === "" ? null : Number(v.replace(",", ".")) })
                }
                step={0.1}
                suffix="kg"
                ariaLabel="Peso"
              />
            </label>
            <div>
              <span className="mb-1 block text-[12px] text-muted-foreground">
                Agua {day?.waterL != null ? `· ${day.waterL.toLocaleString("es-ES")} L` : ""}
              </span>
              <div className="flex gap-1.5">
                {[
                  { label: "+250", d: 0.25 },
                  { label: "+500", d: 0.5 },
                  { label: "botella", d: 0.75 },
                ].map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    onClick={() =>
                      onPatch({
                        waterL: Math.round(((day?.waterL ?? 0) + c.d) * 100) / 100,
                      })
                    }
                    className="flex-1 rounded-lg border border-line bg-surface-2 py-2 text-[12px]"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* % grasa */}
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              % grasa (báscula — solo tendencia mensual)
            </span>
            <Stepper
              value={day?.bodyFatPct != null ? String(day.bodyFatPct) : ""}
              onChange={(v) =>
                onPatch({ bodyFatPct: v === "" ? null : Number(v.replace(",", ".")) })
              }
              step={0.1}
              suffix="%"
              ariaLabel="Porcentaje de grasa"
            />
          </label>

          {/* Sesión + fase */}
          <div className="grid grid-cols-1 gap-3">
            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Sesión</span>
              <Select
                value={day?.sessionLabel ?? NONE}
                onValueChange={(v) =>
                  onPatch({ sessionLabel: v === NONE ? null : v })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Elegir sesión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin sesión</SelectItem>
                  {SESSIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  {day?.sessionLabel && !SESSIONS.includes(day.sessionLabel as never) ? (
                    <SelectItem value={day.sessionLabel}>{day.sessionLabel}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[12px] text-muted-foreground">Fase</span>
              <Select
                value={day?.phase ?? NONE}
                onValueChange={(v) =>
                  onPatch({ phase: v === NONE ? null : (v as PhaseKey) })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Normal</SelectItem>
                  {(Object.keys(PHASE_LABELS) as PhaseKey[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PHASE_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>

          {/* Hinchazón */}
          <div>
            <span className="mb-1 block text-[12px] text-muted-foreground">Hinchazón</span>
            <div className="grid grid-cols-4 gap-1.5">
              {BLOATS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => onPatch({ bloat: day?.bloat === b ? null : b })}
                  className={cn(
                    "rounded-lg border py-2 text-[12px]",
                    day?.bloat === b
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-line bg-surface-2 text-foreground",
                  )}
                >
                  {BLOAT_LABELS[b]}
                </button>
              ))}
            </div>
          </div>

          {/* Notas */}
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Notas del día
            </span>
            <textarea
              defaultValue={day?.notes ?? ""}
              onChange={(e) => onPatch({ notes: e.target.value })}
              rows={2}
              placeholder="¿Cómo fue el WOD? ¿Digestión? ¿Energía?"
              className="w-full rounded-lg border border-input bg-surface-2 px-2.5 py-2 text-base outline-none focus-visible:border-ring"
            />
          </label>

          {/* Línea «Del reloj» */}
          {health ? (
            <p className="num text-[12px] text-muted-foreground">
              Del reloj:{" "}
              {[
                health.steps != null ? `${health.steps.toLocaleString("es-ES")} pasos` : null,
                health.activeKcal != null ? `${health.activeKcal} kcal act.` : null,
                health.basalKcal != null ? `${health.basalKcal} basal` : null,
                health.hrvMs != null ? `HRV ${displayHrv(health.hrvMs)}` : null,
                health.sleepH != null ? `${health.sleepH.toLocaleString("es-ES")} h sueño` : null,
                health.restingHr != null ? `FC ${health.restingHr}` : null,
              ]
                .filter(Boolean)
                .join(" · ") || "sin datos del reloj"}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const displayHrv = (n: number) => Math.round(n);
