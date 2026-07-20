"use client";

import { ChevronRight, ClipboardCheck, Loader2, MoonStar, Scale, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
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
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client-api";
import { labelForKey } from "@/lib/dates";
import {
  BLOAT_LABELS,
  PHASE_LABELS,
  type PhaseKey,
  phaseLabel,
} from "@/lib/macros";
import { orderedSessionOptions, sessionPatchFor } from "@/lib/training";
import type { DayView } from "@/server/db/queries/day";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TrainingSessionDTO } from "@/server/db/queries/training";

const NONE = "__none__";

/**
 * «Mi día» = flow `day-context` (Restyle v2, estructura real del mockup): sheet de
 * corrección posterior con peso/%grasa/agua/fase/sesión/notas + analizador de WOD.
 * Se abre desde el icono de sliders de la sección «Hinchazón del día» (la hinchazón
 * NO se repite aquí: se corrige en el selector visible de Hoy, para no duplicar el
 * control). Autosave optimista vía onPatch; «Guardar cambios» solo cierra.
 */
export function MiDiaSheet({
  open,
  onOpenChange,
  view,
  onPatch,
  trainingSessions = [],
  suggestedPhase = null,
  onCheckinMatinal,
  onPesoExpres,
  onCierre,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  view: DayView;
  onPatch: (patch: DayPatch) => void;
  /** Sesiones reales de la semana importada para esta fecha (doc 10 B3). */
  trainingSessions?: TrainingSessionDTO[];
  /** Fase sugerida tras un día especial (09 §5); valor propuesto, un toque para aplicar. */
  suggestedPhase?: PhaseKey | null;
  /** Accesos rápidos del flow (abren los sheets existentes tras cerrar este). */
  onCheckinMatinal: () => void;
  onPesoExpres: () => void;
  onCierre: () => void;
}) {
  const day = view.day;
  const health = view.health;
  const sessionOptions = orderedSessionOptions(
    trainingSessions.map((s) => s.nombre),
  );

  // Valor EFECTIVO = manual (tu edición) ?? báscula (Apple Health). Así el peso y
  // el % grasa se AUTO-RELLENAN de la báscula y siguen siendo editables (tu edición
  // manda ese día). Ver también la precedencia en getTrendData.
  const effWeight = day?.weight ?? health?.weight ?? null;
  const weightFromScale = day?.weight == null && health?.weight != null;
  const effFat = day?.bodyFatPct ?? health?.bodyFatPct ?? null;
  const fatFromScale = day?.bodyFatPct == null && health?.bodyFatPct != null;

  const calloutTop = [day?.sessionLabel ?? view.session?.nombre, phaseLabel(day?.phase)]
    .filter(Boolean)
    .join(" · ");
  const calloutBottom = [
    effWeight != null ? `${effWeight.toLocaleString("es-ES")} kg` : null,
    day?.waterL != null ? `${day.waterL.toLocaleString("es-ES")} L de agua` : null,
    day?.bloat ? `hinchazón ${BLOAT_LABELS[day.bloat].toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle
            className="text-[18px] font-bold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Mi día
          </SheetTitle>
          <p className="text-[12px] text-muted-foreground">
            Corrección posterior · {labelForKey(view.date)}
          </p>
        </SheetHeader>

        <div className="space-y-4 px-4 pt-2 pb-6">
          {calloutTop || calloutBottom ? (
            <div className="rounded-[14px] border border-primary/25 bg-primary/5 px-3.5 py-2.5">
              {calloutTop ? (
                <p className="text-[13px] font-semibold text-primary">{calloutTop}</p>
              ) : null}
              {calloutBottom ? (
                <p className="num mt-0.5 text-[12px] text-muted-foreground">
                  {calloutBottom}
                </p>
              ) : null}
            </div>
          ) : null}

          {/* Peso (hinchazón y agua viven en la sección «Hinchazón del día» de Hoy) */}
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

          {/* flow-list: accesos rápidos a los rituales existentes (day-context del mockup) */}
          <div className="divide-y divide-line overflow-hidden rounded-[14px] border border-line">
            <FlowRow
              icon={<ClipboardCheck className="size-[18px]" aria-hidden />}
              label="Revisar check-in matinal"
              hint="Peso, hinchazón y sesión · tres pasos"
              onClick={() => {
                onOpenChange(false);
                onCheckinMatinal();
              }}
            />
            <FlowRow
              icon={<Scale className="size-[18px]" aria-hidden />}
              label="Peso exprés"
              hint="Solo corrige el peso de hoy"
              onClick={() => {
                onOpenChange(false);
                onPesoExpres();
              }}
            />
            <FlowRow
              icon={<MoonStar className="size-[18px]" aria-hidden />}
              label="Revisar cierre del día"
              hint="Comidas pendientes, notas y racha"
              onClick={() => {
                onOpenChange(false);
                onCierre();
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground"
          >
            Guardar cambios
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FlowRow({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 bg-surface px-3.5 py-3 text-left transition-colors hover:bg-surface-2"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-primary">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-semibold text-foreground">{label}</span>
        <span className="block text-[12px] text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
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
function WodAnalyzer({
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
