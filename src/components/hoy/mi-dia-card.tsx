"use client";

import { ChevronDown, ChevronUp, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client-api";
import {
  BLOAT_LABELS,
  type BloatKey,
  PHASE_LABELS,
  type PhaseKey,
  phaseLabel,
} from "@/lib/macros";
import { orderedSessionOptions, sessionPatchFor } from "@/lib/training";
import { cn } from "@/lib/utils";
import type { DayView } from "@/server/db/queries/day";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TrainingSessionDTO } from "@/server/db/queries/training";

const NONE = "__none__";
const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];

export function MiDiaCard({
  view,
  onPatch,
  trainingSessions = [],
  suggestedPhase = null,
}: {
  view: DayView;
  onPatch: (patch: DayPatch) => void;
  /** Sesiones reales de la semana importada para esta fecha (doc 10 B3). */
  trainingSessions?: TrainingSessionDTO[];
  /** Fase sugerida tras un día especial (09 §5); valor propuesto, un toque para aplicar. */
  suggestedPhase?: PhaseKey | null;
}) {
  const day = view.day;
  const health = view.health;
  const sessionOptions = orderedSessionOptions(
    trainingSessions.map((s) => s.nombre),
  );
  const hasContent =
    !!day &&
    (day.weight != null ||
      day.sessionLabel != null ||
      day.phase != null ||
      day.bloat != null ||
      day.notes != null ||
      day.waterL != null);
  const [open, setOpen] = useState(!hasContent);

  // Valor EFECTIVO = manual (tu edición) ?? báscula (Apple Health). Así el peso y
  // el % grasa se AUTO-RELLENAN de la báscula y siguen siendo editables (tu edición
  // manda ese día). Ver también la precedencia en getTrendData.
  const effWeight = day?.weight ?? health?.weight ?? null;
  const weightFromScale = day?.weight == null && health?.weight != null;
  const effFat = day?.bodyFatPct ?? health?.bodyFatPct ?? null;
  const fatFromScale = day?.bodyFatPct == null && health?.bodyFatPct != null;

  const summary = [
    day?.sessionLabel,
    phaseLabel(day?.phase),
    effWeight != null ? `${effWeight.toLocaleString("es-ES")} kg` : null,
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
                Peso (kg, ayunas){weightFromScale ? " · de la báscula" : ""}
              </span>
              <Stepper
                value={effWeight != null ? String(effWeight) : ""}
                onChange={(v) =>
                  onPatch({ weight: v === "" ? null : Number(v.replace(",", ".")) })
                }
                step={0.1}
                suffix="kg"
                ariaLabel="Peso"
              />
            </label>
            <div>
              <span className="num mb-1 block text-[12px] text-muted-foreground">
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
              {fatFromScale ? " · de la báscula" : ""}
            </span>
            <Stepper
              value={effFat != null ? String(effFat) : ""}
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
                  onPatch(
                    v === NONE
                      ? { sessionLabel: null, sessionRef: null, sessionKcal: null }
                      : sessionPatchFor(v, trainingSessions),
                  )
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Elegir sesión" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin sesión</SelectItem>
                  {sessionOptions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                  {day?.sessionLabel && !sessionOptions.includes(day.sessionLabel) ? (
                    <SelectItem value={day.sessionLabel}>{day.sessionLabel}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
              <WodAnalyzer date={view.date} onPatch={onPatch} />
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
              {suggestedPhase && day?.phase == null ? (
                <button
                  type="button"
                  onClick={() => onPatch({ phase: suggestedPhase })}
                  className="mt-1.5 text-left text-[12px] font-medium text-primary"
                >
                  Sugerida hoy: {PHASE_LABELS[suggestedPhase]} · aplicar
                </button>
              ) : null}
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

          {/* Línea «Del reloj» (incluye extras: masa magra, ejercicio, recuperación) */}
          {health ? (
            <p className="num text-[12px] text-muted-foreground">
              Del reloj:{" "}
              {relojLine(health) || "sin datos del reloj"}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const displayHrv = (n: number) => Math.round(n);
const r1 = (n: number) => n.toLocaleString("es-ES", { maximumFractionDigits: 1 });

/** Línea «Del reloj»: métricas tipadas + las extras interesantes (masa magra,
 *  ejercicio, SpO2, frecuencia respiratoria, temperatura de muñeca). */
function relojLine(health: NonNullable<DayView["health"]>): string {
  const x = health.extra ?? {};
  return [
    health.steps != null ? `${health.steps.toLocaleString("es-ES")} pasos` : null,
    health.activeKcal != null ? `${health.activeKcal} kcal act.` : null,
    health.basalKcal != null ? `${health.basalKcal} basal` : null,
    x.apple_exercise_time != null ? `${Math.round(x.apple_exercise_time)} min ejerc.` : null,
    health.hrvMs != null ? `HRV ${displayHrv(health.hrvMs)}` : null,
    health.sleepH != null && health.sleepH > 0 ? `${r1(health.sleepH)} h sueño` : null,
    health.restingHr != null ? `FC ${health.restingHr}` : null,
    x.lean_body_mass != null ? `magra ${r1(x.lean_body_mass)} kg` : null,
    x.blood_oxygen_saturation != null ? `SpO₂ ${r1(x.blood_oxygen_saturation)}%` : null,
    x.respiratory_rate != null ? `resp ${r1(x.respiratory_rate)}` : null,
    x.apple_sleeping_wrist_temperature != null
      ? `temp ${r1(x.apple_sleeping_wrist_temperature)}°`
      : null,
    health.vo2max != null ? `VO₂ ${r1(health.vo2max)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** F-IA-5 · Analizar sesión pegada (WOD). El gasto es CONTEXTO (±25%), no la
 *  verdad — la verdad del gasto es el peso (principio 1). */
export function WodAnalyzer({
  date,
  onPatch,
}: {
  date: string;
  onPatch: (patch: DayPatch) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    nombre: string;
    duracion_min: number;
    kcal_min: number;
    kcal_max: number;
    comentario: string;
  } | null>(null);

  const analyze = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api.analyzeWod(text.trim(), date);
      setResult(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo analizar el WOD.");
    } finally {
      setBusy(false);
    }
  };

  const use = () => {
    if (!result) return;
    const kcal = Math.round((result.kcal_min + result.kcal_max) / 2);
    onPatch({ sessionLabel: result.nombre, sessionKcal: kcal });
    toast.success(`Sesión: ${result.nombre} · ~${kcal} kcal (contexto)`);
    setOpen(false);
    setText("");
    setResult(null);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] text-primary"
      >
        <Sparkles className="size-3.5" aria-hidden /> Analizar WOD pegado
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-line bg-surface-2/50 p-2.5">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Pega aquí el WOD / la sesión (fuerza, metcon, accesorios)…"
        className="w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-base outline-none focus-visible:border-ring"
      />
      <button
        type="button"
        onClick={analyze}
        disabled={busy || !text.trim()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {busy ? "Analizando…" : "Analizar"}
      </button>

      {result ? (
        <div className="rounded-lg bg-surface px-2.5 py-2">
          <div className="text-[13px] font-medium text-foreground">{result.nombre}</div>
          <div className="num text-[12px] text-muted-foreground">
            {Math.round(result.duracion_min)} min · {Math.round(result.kcal_min)}–
            {Math.round(result.kcal_max)} kcal
          </div>
          <p className="mt-1 text-[12px] text-muted-foreground">{result.comentario}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Es contexto (±25%), no la verdad: el gasto real sale del peso.
          </p>
          <button
            type="button"
            onClick={use}
            className="mt-2 w-full rounded-lg border border-line bg-surface-2 py-2 text-[13px] font-medium"
          >
            Usar como sesión de hoy
          </button>
        </div>
      ) : null}
    </div>
  );
}
