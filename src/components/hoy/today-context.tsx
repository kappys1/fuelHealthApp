"use client";

import {
  Activity,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Dumbbell,
  Footprints,
  GlassWater,
  HeartPulse,
  Moon,
  Scale,
  TriangleAlert,
  Watch,
  Waves,
} from "lucide-react";
import { useState } from "react";
import { WodAnalyzer } from "@/components/hoy/mi-dia-card";
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
  BLOAT_LABELS,
  type BloatKey,
  PHASE_LABELS,
  type PhaseKey,
  phaseLabel,
} from "@/lib/macros";
import { orderedSessionOptions, sessionPatchFor } from "@/lib/training";
import { cn } from "@/lib/utils";
import type {
  BaselineMetricKey,
  HealthBaseline,
} from "@/server/analytics/healthBaseline";
import { dayTotals } from "@/server/analytics/dayTotals";
import { energyBalance } from "@/server/analytics/energyBalance";
import type { BloatEventDTO } from "@/server/db/queries/bloat";
import type { DayView } from "@/server/db/queries/day";
import type { HealthSyncView } from "@/server/db/queries/health";
import type { DayPatch } from "@/server/db/queries/mutations";
import type { TrainingSessionDTO } from "@/server/db/queries/training";

const NONE = "__none__";
const BLOATS: BloatKey[] = ["ninguna", "leve", "moderada", "alta"];
const MADRID_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function DailyChecks({
  view,
  bloatEvents,
  onPatch,
  onBloat,
  onReviewCheckin,
}: {
  view: DayView;
  bloatEvents: BloatEventDTO[];
  onPatch: (patch: DayPatch) => void;
  onBloat: (severity: BloatKey) => void;
  onReviewCheckin: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const currentBloat = bloatEvents.at(-1)?.severity ?? view.day?.bloat ?? null;
  const water = view.day?.waterL ?? view.health?.waterL ?? 0;

  return (
    <section className="wellness-card p-[18px]" aria-labelledby="daily-checks-title">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="daily-checks-title" className="text-[15px] font-semibold text-foreground">
            Contexto del día
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Agua y digestión</p>
        </div>
        <button
          type="button"
          onClick={onReviewCheckin}
          className="min-h-11 rounded-lg px-2 text-[12px] font-semibold text-primary"
        >
          Revisar check-in
        </button>
      </div>

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="grid size-7 place-items-center rounded-lg bg-primary-soft text-special">
            <Waves className="size-4" aria-hidden />
          </span>
          <span className="text-[12px] font-medium text-foreground">Hinchazón del día</span>
        </div>
        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Nivel de hinchazón">
          {BLOATS.map((severity) => (
            <button
              key={severity}
              type="button"
              onClick={() => onBloat(severity)}
              aria-pressed={currentBloat === severity}
              className={cn(
                "min-h-11 rounded-xl border px-1 text-[11px] font-medium",
                currentBloat === severity
                  ? "border-primary bg-primary-soft text-primary"
                  : "border-line bg-surface text-muted-foreground",
              )}
            >
              {BLOAT_LABELS[severity]}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <GlassWater className="size-[18px]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[13px] font-semibold text-foreground">Agua</strong>
            <span className="mt-0.5 block font-display text-[11px] tabular-nums text-muted-foreground">
              {water.toLocaleString("es-ES", { maximumFractionDigits: 2 })} L registradas
            </span>
          </span>
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className="app-icon-button"
            aria-label="Corregir agua y datos del día"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { label: "+250 ml", amount: 0.25 },
            { label: "+500 ml", amount: 0.5 },
            { label: "+ Botella", amount: 0.75 },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() =>
                onPatch({ waterL: Math.round((water + option.amount) * 100) / 100 })
              }
              className="min-h-11 rounded-xl bg-surface-2 px-1 text-[11px] font-semibold text-foreground"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setDetailsOpen(true)}
        className="mt-3 flex min-h-11 w-full items-center gap-2 rounded-xl text-left text-[12px] text-muted-foreground"
      >
        <Scale className="size-4 text-primary" aria-hidden />
        <span className="flex-1">Peso, composición y notas</span>
        <ArrowRight className="size-4" aria-hidden />
      </button>

      <DayDetailsSheet
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        view={view}
        onPatch={onPatch}
      />
    </section>
  );
}

function DayDetailsSheet({
  open,
  onOpenChange,
  view,
  onPatch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: DayView;
  onPatch: (patch: DayPatch) => void;
}) {
  const weight = view.day?.weight ?? view.health?.weight ?? null;
  const fat = view.day?.bodyFatPct ?? view.health?.bodyFatPct ?? null;
  const water = view.day?.waterL ?? view.health?.waterL ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Datos del día</SheetTitle>
          <SheetDescription>Peso, composición, hidratación y notas personales.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <label htmlFor="day-weight" className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Peso en ayunas</span>
            <Stepper
              value={weight == null ? "" : String(weight)}
              onChange={(value) => onPatch({ weight: decimalOrNull(value) })}
              step={0.1}
              suffix="kg"
              ariaLabel="Peso"
              id="day-weight"
            />
          </label>
          <label htmlFor="day-body-fat" className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Grasa corporal</span>
            <Stepper
              value={fat == null ? "" : String(fat)}
              onChange={(value) => onPatch({ bodyFatPct: decimalOrNull(value) })}
              step={0.1}
              suffix="%"
              ariaLabel="Porcentaje de grasa"
              id="day-body-fat"
            />
          </label>
          <label htmlFor="day-water" className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Agua</span>
            <Stepper
              value={water == null ? "" : String(water)}
              onChange={(value) => onPatch({ waterL: decimalOrNull(value) })}
              step={0.25}
              suffix="L"
              ariaLabel="Agua"
              id="day-water"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Notas del día</span>
            <textarea
              defaultValue={view.day?.notes ?? ""}
              onChange={(event) => onPatch({ notes: event.target.value })}
              rows={4}
              className="w-full rounded-xl border border-input bg-surface-2 px-3 py-2.5 text-base outline-none focus-visible:border-ring"
              placeholder="Digestión, energía o sensaciones del entrenamiento"
            />
          </label>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function TrainingSection({
  view,
  onPatch,
  trainingSessions,
  suggestedPhase,
}: {
  view: DayView;
  onPatch: (patch: DayPatch) => void;
  trainingSessions: TrainingSessionDTO[];
  suggestedPhase: PhaseKey | null;
}) {
  const [open, setOpen] = useState(false);
  const day = view.day;
  const session = day?.sessionLabel ?? view.session?.nombre ?? "Sin sesión registrada";
  const kcal = view.health?.activeKcal ?? day?.sessionKcal ?? null;
  const choices = orderedSessionOptions(trainingSessions.map((item) => item.nombre));

  return (
    <section aria-labelledby="training-title">
      <div className="mb-3">
        <h2 id="training-title" className="section-title">Entrenamiento</h2>
        <p className="section-copy">Sesión y fase del día</p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wellness-card flex min-h-[82px] w-full items-center gap-3 p-[18px] text-left"
      >
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-[14px] font-semibold text-foreground">{session}</strong>
          <span className="mt-1 block text-[11px] text-muted-foreground">
            {day?.phase ? `Fase ${phaseLabel(day.phase)}` : "Fase normal"}
          </span>
        </span>
        {kcal != null ? (
          <span className="shrink-0 text-right">
            <strong className="block font-display text-[18px] font-semibold tabular-nums text-foreground">{kcal}</strong>
            <span className="text-[10px] text-muted-foreground">kcal activas</span>
          </span>
        ) : null}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Entrenamiento del día</SheetTitle>
            <SheetDescription>Asigna la sesión y ajusta fases especiales.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Sesión</span>
              <Select
                value={day?.sessionLabel ?? NONE}
                onValueChange={(value) =>
                  onPatch(
                    value === NONE
                      ? { sessionLabel: null, sessionRef: null, sessionKcal: null }
                      : sessionPatchFor(value, trainingSessions),
                  )
                }
              >
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin sesión</SelectItem>
                  {choices.map((choice) => <SelectItem key={choice} value={choice}>{choice}</SelectItem>)}
                  {day?.sessionLabel && !choices.includes(day.sessionLabel) ? (
                    <SelectItem value={day.sessionLabel}>{day.sessionLabel}</SelectItem>
                  ) : null}
                </SelectContent>
              </Select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[12px] text-muted-foreground">Fase</span>
              <Select
                value={day?.phase ?? NONE}
                onValueChange={(value) => onPatch({ phase: value === NONE ? null : value as PhaseKey })}
              >
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Normal</SelectItem>
                  {(Object.keys(PHASE_LABELS) as PhaseKey[]).map((phase) => (
                    <SelectItem key={phase} value={phase}>{PHASE_LABELS[phase]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {suggestedPhase && day?.phase == null ? (
                <button
                  type="button"
                  onClick={() => onPatch({ phase: suggestedPhase })}
                  className="mt-2 min-h-11 text-left text-[12px] font-semibold text-primary"
                >
                  Sugerida: {PHASE_LABELS[suggestedPhase]} · aplicar
                </button>
              ) : null}
            </label>
            <WodAnalyzer date={view.date} onPatch={onPatch} />
          </div>
        </SheetContent>
      </Sheet>
    </section>
  );
}

const BASELINE_CONFIG: Record<
  BaselineMetricKey,
  { label: string; unit: string; decimals: number; Icon: typeof Activity; tone: string }
> = {
  hrvMs: { label: "HRV", unit: "ms", decimals: 0, Icon: Activity, tone: "text-primary bg-primary-soft" },
  restingHr: { label: "FC reposo", unit: "lpm", decimals: 0, Icon: HeartPulse, tone: "text-fat bg-surface-2" },
  sleepH: { label: "Sueño", unit: "h", decimals: 1, Icon: Moon, tone: "text-sleep bg-surface-2" },
  steps: { label: "Pasos", unit: "", decimals: 0, Icon: Footprints, tone: "text-carb bg-surface-2" },
};

export function BaselineSection({ baseline }: { baseline: HealthBaseline }) {
  return (
    <section aria-labelledby="baseline-title">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 id="baseline-title" className="section-title">Baseline personal</h2>
          <p className="section-copy">Métrica cruda · Δ vs tu media 30d</p>
        </div>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">Apple Health</span>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {(Object.keys(BASELINE_CONFIG) as BaselineMetricKey[]).map((key) => {
          const config = BASELINE_CONFIG[key];
          const metric = baseline.metrics[key];
          const invalidSleep = key === "sleepH" && metric.current != null && metric.current <= 0;
          const delta = metric.delta;
          const good = delta != null && (key === "restingHr" ? delta < 0 : delta > 0);
          const DeltaIcon = delta != null && delta > 0 ? ArrowUp : ArrowDown;
          return (
            <article key={key} className="rounded-2xl border border-line bg-surface p-3.5 shadow-card">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">{config.label}</span>
                <span className={`grid size-7 place-items-center rounded-lg ${config.tone}`}>
                  <config.Icon className="size-3.5" aria-hidden />
                </span>
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <strong className="font-display text-[24px] leading-none font-semibold tabular-nums text-foreground">
                  {metric.current == null ? "—" : formatNumber(metric.current, config.decimals)}
                </strong>
                {config.unit ? <span className="text-[10px] text-muted-foreground">{config.unit}</span> : null}
              </p>
              <p
                className={cn(
                  "mt-2 flex min-h-8 items-start gap-1 text-[10px] leading-snug",
                  invalidSleep
                    ? "text-carb"
                    : delta == null
                      ? "text-muted-foreground"
                      : good
                        ? "text-protein"
                        : "text-fat",
                )}
              >
                {invalidSleep ? (
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden />
                ) : delta != null ? (
                  <DeltaIcon className="mt-0.5 size-3 shrink-0" aria-hidden />
                ) : null}
                <span>
                  {invalidSleep
                    ? "importación no fiable"
                    : delta != null && metric.average30d != null
                      ? `${delta > 0 ? "+" : ""}${formatNumber(delta, config.decimals)}${config.unit ? ` ${config.unit}` : ""} vs ${formatNumber(metric.average30d, config.decimals)}`
                      : metric.sampleCount > 0
                        ? "sin dato actual"
                        : "sin media 30d"}
                </span>
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function WatchContextSection({
  view,
  healthSync,
}: {
  view: DayView;
  healthSync: HealthSyncView | null;
}) {
  const totals = dayTotals(view.entries);
  const balance = energyBalance({
    intakeKcal: totals.kcal,
    basalKcal: view.health?.basalKcal ?? null,
    activeKcal: view.health?.activeKcal ?? null,
    sessionKcal: view.day?.sessionKcal ?? null,
  });

  return (
    <section aria-labelledby="watch-title">
      <div className="mb-3">
        <h2 id="watch-title" className="section-title">Contexto del reloj</h2>
        <p className="section-copy">Orientativo; la tendencia del peso manda</p>
      </div>
      <div className="wellness-card flex items-center gap-3 p-[18px]">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Watch className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <strong className="block text-[13px] font-semibold text-foreground">
            Balance del día · orientativo ±25%
          </strong>
          <span className="mt-1 block text-[11px] leading-snug text-muted-foreground">
            {balance.basis === "none"
              ? "Sin datos suficientes de gasto"
              : `${Math.round(balance.intakeKcal).toLocaleString("es-ES")} ingesta · ${balance.breakdown}`}
          </span>
          <span className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
            {healthSync ? (
              <>
                {healthSync.stale ? <TriangleAlert className="size-3 text-carb" aria-hidden /> : null}
                Última sincronización {healthSync.ago} {healthSync.stale ? "⚠" : "✓"}
              </>
            ) : (
              "Reloj nunca sincronizado"
            )}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <strong className="block font-display text-[25px] leading-none font-semibold tabular-nums text-foreground">
            {balance.balanceKcal == null
              ? "—"
              : `${balance.balanceKcal > 0 ? "+" : ""}${Math.round(balance.balanceKcal).toLocaleString("es-ES")}`}
          </strong>
          <span className="text-[10px] text-muted-foreground">kcal</span>
        </div>
      </div>
    </section>
  );
}

export function BloatEventSheet({
  open,
  onOpenChange,
  event,
  initialSeverity,
  isToday,
  onCreate,
  onUpdate,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: BloatEventDTO | null;
  initialSeverity: BloatKey;
  isToday: boolean;
  onCreate: (severity: BloatKey, occurredAt: string) => Promise<void>;
  onUpdate: (id: number, patch: { severity: BloatKey; occurredAt: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}) {
  const [severity, setSeverity] = useState<BloatKey>(event?.severity ?? initialSeverity);
  const [time, setTime] = useState(
    () => event?.occurredAt.slice(0, 5) ?? (isToday ? madridTime() : ""),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!time || busy) return;
    setBusy(true);
    try {
      if (event) await onUpdate(event.id, { severity, occurredAt: time });
      else await onCreate(severity, time);
      onOpenChange(false);
    } catch {
      // La mutación ya muestra el error; se mantiene el sheet abierto.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{event ? "Editar hinchazón" : "Registrar hinchazón"}</SheetTitle>
          <SheetDescription>El marcador conserva la hora real y no atribuye una causa.</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-6">
          <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Nivel de hinchazón">
            {BLOATS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSeverity(item)}
                aria-pressed={severity === item}
                className={cn(
                  "min-h-11 rounded-xl border px-1 text-[11px] font-medium",
                  severity === item
                    ? "border-primary bg-primary-soft text-primary"
                    : "border-line bg-surface-2 text-muted-foreground",
                )}
              >
                {BLOAT_LABELS[item]}
              </button>
            ))}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[12px] text-muted-foreground">Hora</span>
            <input
              type="time"
              value={time}
              onChange={(changeEvent) => setTime(changeEvent.target.value)}
              className="h-11 w-full rounded-xl border border-input bg-surface-2 px-3 text-base text-foreground"
              required
            />
          </label>
          <button
            type="button"
            onClick={() => void save()}
            disabled={!time || busy}
            className="min-h-11 w-full rounded-xl bg-primary text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar marcador"}
          </button>
          {event ? (
            <button
              type="button"
              onClick={() => {
                setBusy(true);
                void onDelete(event.id)
                  .then(() => onOpenChange(false))
                  .catch(() => undefined)
                  .finally(() => setBusy(false));
              }}
              disabled={busy}
              className="min-h-11 w-full rounded-xl text-[13px] font-medium text-destructive disabled:opacity-50"
            >
              Eliminar marcador
            </button>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function madridTime(): string {
  return MADRID_TIME_FORMATTER.format(new Date());
}

function decimalOrNull(value: string): number | null {
  return value === "" ? null : Number(value.replace(",", "."));
}

function formatNumber(value: number, decimals: number): string {
  return value.toLocaleString("es-ES", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
