"use client";

import {
  CalendarDays,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Dumbbell,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/client-api";
import { labelForKey, shiftDayKey } from "@/lib/dates";
import {
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
  TRAINING_TIPOS,
  trainingWeekSpan,
} from "@/lib/training";
import type { TrainingWeekView } from "@/server/db/queries/training";
import { TrainingImport } from "./training-import";

const NONE = "__none__";
const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const DAY_NUMBER_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  timeZone: "Europe/Madrid",
});
const WEEK_RANGE_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Madrid",
});
const n = (value: string) =>
  value === "" ? 0 : Number(value.replace(",", "."));
const intOrNull = (value: string) =>
  value.trim() === "" ? null : Math.round(n(value));

function formatDayNumber(date: string): string {
  return DAY_NUMBER_FORMATTER.format(new Date(`${date}T12:00:00`));
}

function formatWeekRange(start: string): string {
  const end = shiftDayKey(start, 6);
  return `${WEEK_RANGE_FORMATTER.format(new Date(`${start}T12:00:00`))} – ${WEEK_RANGE_FORMATTER.format(new Date(`${end}T12:00:00`))}`;
}

export function TrainingWeek({
  week,
  selectedWeek,
  today,
}: {
  week: TrainingWeekView | null;
  selectedWeek: string;
  today: string;
}) {
  const router = useRouter();
  const currentWeek = trainingWeekSpan(today).validFrom;
  const isPast = selectedWeek < currentWeek;
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftDayKey(selectedWeek, index),
  );
  const weekDateSet = new Set(weekDates);
  const weekEnd = weekDates[6] ?? selectedWeek;
  const initialDay =
    today >= selectedWeek && today <= weekEnd
      ? today
      : week?.sessions.find(
            (session) =>
              session.assignedDate && weekDateSet.has(session.assignedDate),
          )?.assignedDate ?? selectedWeek;
  const [selectedDay, setSelectedDay] = useState(() => initialDay);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const navigate = (date: string) => {
    const monday = trainingWeekSpan(date).validFrom;
    router.push(`/plan?tab=entrenos&week=${monday}`);
  };

  const deletePlan = async () => {
    if (!week || isPast) return;
    setDeleting(true);
    try {
      await api.deleteTrainingPlan(week.plan.id);
      toast.success("Semana borrada.");
      setDeleteOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  };

  const sessions = week?.sessions ?? [];
  const selectedSession = sessions.find(
    (session) => session.assignedDate === selectedDay,
  );
  const unassigned = sessions.filter((session) => session.assignedDate == null);

  return (
    <div className="space-y-6">
      {!isPast ? <TrainingImport /> : null}

      <section aria-label="Cambiar semana de entrenamiento" className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="app-icon-button shrink-0"
            aria-label="Semana anterior"
            onClick={() => navigate(shiftDayKey(selectedWeek, -7))}
          >
            <ChevronLeft className="size-5" aria-hidden />
          </button>

          <label className="relative flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl bg-surface-2 px-3 text-center">
            <span className="min-w-0">
              <strong className="num block truncate text-[14px] font-semibold text-foreground">
                {formatWeekRange(selectedWeek)}
              </strong>
              <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                {week ? `${week.plan.programa} · ${week.plan.etiqueta}` : "Seleccionar otra semana"}
              </span>
            </span>
            <input
              type="date"
              value={selectedWeek}
              max={currentWeek}
              onChange={(event) => event.target.value && navigate(event.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0 text-base"
              aria-label="Elegir semana por fecha"
            />
          </label>

          <button
            type="button"
            className="app-icon-button shrink-0 disabled:opacity-35"
            aria-label="Semana siguiente"
            disabled={selectedWeek >= currentWeek}
            onClick={() => navigate(shiftDayKey(selectedWeek, 7))}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Días de la semana">
          {weekDates.map((date, index) => {
            const active = selectedDay === date;
            const hasSession = sessions.some(
              (session) => session.assignedDate === date,
            );
            return (
              <button
                key={date}
                type="button"
                aria-pressed={active}
                aria-label={`${labelForKey(date)}${hasSession ? ", con sesión" : ", sin sesión"}`}
                onClick={() => setSelectedDay(date)}
                className={`relative flex min-h-[58px] min-w-11 flex-1 flex-col items-center justify-center rounded-xl border text-center transition-colors ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-surface text-muted-foreground"
                }`}
              >
                <span className="text-[10px] font-semibold">{WEEKDAYS[index]}</span>
                <strong className="num mt-0.5 text-[15px] font-semibold">
                  {formatDayNumber(date)}
                </strong>
                {hasSession ? (
                  <span
                    className={`absolute bottom-1.5 size-1 rounded-full ${active ? "bg-primary-foreground" : "bg-protein"}`}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {!week ? (
        <section className="wellness-card p-6 text-center" aria-live="polite">
          <span className="mx-auto inline-flex size-11 items-center justify-center rounded-xl bg-surface-2 text-primary">
            <CalendarSearch className="size-5" aria-hidden />
          </span>
          <h2 className="mt-3 text-[14px] font-semibold text-foreground">
            Sin plan guardado para esta semana
          </h2>
          <p className="mx-auto mt-1 max-w-[28ch] text-[12px] leading-relaxed text-muted-foreground">
            {isPast
              ? "No hay una semana importada en este periodo. Puedes consultar otra fecha."
              : "Importa tu programación para revisar y asignar cada sesión."}
          </p>
        </section>
      ) : (
        <>
          <section className="wellness-card overflow-hidden">
            <div className="flex items-start gap-3 border-b border-line p-5">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarDays className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-semibold text-foreground">
                  {week.plan.programa} · {week.plan.etiqueta}
                </h2>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {sessions.length} {sessions.length === 1 ? "sesión" : "sesiones"}
                  {isPast ? " · solo lectura" : " · semana editable"}
                </p>
              </div>
              {!isPast ? (
                <button
                  type="button"
                  onClick={() => setDeleteOpen(true)}
                  aria-label="Borrar semana"
                  className="app-icon-button shrink-0 hover:text-destructive"
                >
                  <Trash2 className="size-[18px]" aria-hidden />
                </button>
              ) : null}
            </div>

            <div className="p-5">
              <p className="ui-label">{labelForKey(selectedDay)}</p>
              {selectedSession ? (
                <div className="mt-3">
                  <SessionCard
                    session={selectedSession}
                    days={weekDates}
                    readOnly={isPast}
                    onChanged={() => router.refresh()}
                  />
                </div>
              ) : (
                <div className="wellness-panel mt-3 flex items-center gap-3 p-4">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface text-muted-foreground">
                    <CalendarSearch className="size-[18px]" aria-hidden />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">
                      Sin sesión asignada
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {isPast
                        ? "No consta entrenamiento para este día."
                        : "Asigna una de las sesiones pendientes desde abajo."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {unassigned.length > 0 ? (
            <section className="space-y-3">
              <div>
                <h2 className="section-title">Sin asignar</h2>
                <p className="section-copy">
                  {isPast
                    ? "Sesiones que quedaron fuera del calendario"
                    : "Elige un día para completar la semana"}
                </p>
              </div>
              <div className="wellness-card divide-y divide-line overflow-hidden px-5">
                {unassigned.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    days={weekDates}
                    readOnly={isPast}
                    compact
                    onChanged={() => router.refresh()}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {week ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Borrar semana de entrenamiento"
          description={`Se borrará «${week.plan.programa} · ${week.plan.etiqueta}» y sus sesiones importadas. Los días ya registrados se conservan.`}
          confirmLabel="Borrar semana"
          busy={deleting}
          onConfirm={deletePlan}
        />
      ) : null}
    </div>
  );
}

function SessionCard({
  session,
  days,
  readOnly,
  compact = false,
  onChanged,
}: {
  session: TrainingWeekView["sessions"][number];
  days: string[];
  readOnly: boolean;
  compact?: boolean;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const reassign = async (date: string | null) => {
    if (readOnly) return;
    setBusy(true);
    try {
      await api.reassignTrainingSession(session.id, date);
      toast.success(date ? "Sesión asignada." : "Sesión desasignada.");
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo reasignar.",
      );
    } finally {
      setBusy(false);
    }
  };

  if (editing && !readOnly) {
    return (
      <SessionForm
        session={session}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-protein/10 text-protein">
          <Dumbbell className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">
            <span className="text-muted-foreground">{session.key}</span>{" "}
            {session.nombre}
          </p>
          <p className="num mt-1 text-[11px] text-muted-foreground">
            {TRAINING_TIPO_LABELS[session.tipo]}
            {session.duracionMin != null ? ` · ${session.duracionMin} min` : ""}
            {session.kcalMin != null || session.kcalMax != null
              ? ` · ${session.kcalMin ?? "?"}–${session.kcalMax ?? "?"} kcal`
              : ""}
          </p>
          {session.contenido ? (
            <p
              className={`mt-2 whitespace-pre-line text-[12px] leading-relaxed text-muted-foreground ${compact && !expanded ? "line-clamp-2" : ""}`}
            >
              {session.contenido}
            </p>
          ) : null}
          {compact && session.contenido ? (
            <button
              type="button"
              className="mt-1.5 min-h-11 rounded-xl pr-3 text-[12px] font-semibold text-primary"
              aria-expanded={expanded}
              onClick={() => setExpanded((value) => !value)}
            >
              {expanded ? "Ocultar detalle" : "Ver detalle"}
            </button>
          ) : null}
        </div>
        {!readOnly ? (
          <button
            type="button"
            aria-label="Editar sesión"
            onClick={() => setEditing(true)}
            className="app-icon-button shrink-0 border-0 bg-surface-2"
          >
            <Pencil className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      {!readOnly ? (
        <label className="mt-4 flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock3 className="size-4" aria-hidden /> Día
          </span>
          <Select
            value={session.assignedDate ?? NONE}
            onValueChange={(value) => reassign(value === NONE ? null : value)}
            disabled={busy}
          >
            <SelectTrigger className="min-h-11 flex-1 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Sin asignar</SelectItem>
              {days.map((date) => (
                <SelectItem key={date} value={date}>
                  {labelForKey(date)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      ) : null}
    </article>
  );
}

function SessionForm({
  session,
  onDone,
  onCancel,
}: {
  session: TrainingWeekView["sessions"][number];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [nombre, setNombre] = useState(session.nombre);
  const [tipo, setTipo] = useState<TrainingTipo>(session.tipo);
  const [contenido, setContenido] = useState(session.contenido);
  const [kcalMin, setKcalMin] = useState(
    session.kcalMin != null ? String(session.kcalMin) : "",
  );
  const [kcalMax, setKcalMax] = useState(
    session.kcalMax != null ? String(session.kcalMax) : "",
  );
  const [duracion, setDuracion] = useState(
    session.duracionMin != null ? String(session.duracionMin) : "",
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!nombre.trim()) {
      toast.error("La sesión necesita nombre.");
      return;
    }
    setBusy(true);
    try {
      await api.updateTrainingSession(session.id, {
        nombre: nombre.trim(),
        tipo,
        contenido: contenido.trim(),
        kcalMin: intOrNull(kcalMin),
        kcalMax: intOrNull(kcalMax),
        duracionMin: intOrNull(duracion),
      });
      toast.success("Sesión actualizada.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 py-4 first:pt-0 last:pb-0">
      <label className="block">
        <span className="ui-label mb-1.5 block">Nombre</span>
        <input
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          className="min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <label className="block">
        <span className="ui-label mb-1.5 block">Contenido</span>
        <textarea
          value={contenido}
          onChange={(event) => setContenido(event.target.value)}
          rows={4}
          className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
        <label className="block">
          <span className="ui-label mb-1.5 block">Tipo</span>
          <Select value={tipo} onValueChange={(value) => setTipo(value as TrainingTipo)}>
            <SelectTrigger className="min-h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_TIPOS.map((trainingType) => (
                <SelectItem key={trainingType} value={trainingType}>
                  {TRAINING_TIPO_LABELS[trainingType]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <MiniInput label="Duración" suffix="min" value={duracion} onChange={setDuracion} />
        <MiniInput label="Gasto mínimo" suffix="kcal" value={kcalMin} onChange={setKcalMin} />
        <MiniInput label="Gasto máximo" suffix="kcal" value={kcalMax} onChange={setKcalMax} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-4 text-[14px] font-semibold text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="min-h-11 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}

function MiniInput({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="ui-label mb-1.5 block">{label}</span>
      <span className="flex min-h-11 items-center rounded-xl border border-input bg-surface px-3">
        <input
          value={value}
          inputMode="numeric"
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "" || /^[0-9]*$/.test(raw)) onChange(raw);
          }}
          onFocus={(event) => event.currentTarget.select()}
          className="num h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          aria-label={label}
        />
        <span className="text-[11px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}
