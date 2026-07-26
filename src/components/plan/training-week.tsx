"use client";

import {
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TrainingSessionDetail } from "@/components/training/training-session-detail";
import { TrainingSessionComposer } from "@/components/training/training-session-composer";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { api } from "@/lib/client-api";
import { labelForKey, shiftDayKey } from "@/lib/dates";
import {
  createTrainingAssignment,
  type TrainingAssignmentState,
  changeAssignmentDate,
  overrideAssignmentFranja,
} from "@/lib/training-assignment";
import type {
  SessionFranja,
  TrainingByWeekday,
} from "@/lib/training-slot";
import {
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
  TRAINING_TIPOS,
  trainingWeekNavigation,
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

function formatDayNumber(date: string): string {
  return DAY_NUMBER_FORMATTER.format(new Date(`${date}T12:00:00`));
}

function formatWeekRange(start: string): string {
  const end = shiftDayKey(start, 6);
  return `${WEEK_RANGE_FORMATTER.format(new Date(`${start}T12:00:00`))} – ${WEEK_RANGE_FORMATTER.format(new Date(`${end}T12:00:00`))}`;
}

function intOrNull(value: string): number | null {
  if (!value.trim()) return null;
  return Math.round(Number(value.replace(",", ".")));
}

export function TrainingWeek({
  week,
  selectedWeek,
  today,
  trainingByWeekday,
}: {
  week: TrainingWeekView | null;
  selectedWeek: string;
  today: string;
  trainingByWeekday: TrainingByWeekday;
}) {
  const router = useRouter();
  const { isPast } = trainingWeekNavigation(
    selectedWeek,
    today,
  );
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftDayKey(selectedWeek, index),
  );
  const weekEnd = weekDates[6] ?? selectedWeek;
  const initialDay =
    today >= selectedWeek && today <= weekEnd
      ? today
      : week?.sessions.find((session) => session.assignedDate)?.assignedDate ??
        selectedWeek;
  const [selectedDay, setSelectedDay] = useState(initialDay);
  const [editing, setEditing] = useState(false);
  const [weekOpen, setWeekOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const navigate = (date: string) => {
    router.push(
      `/plan?tab=entrenos&week=${trainingWeekSpan(date).validFrom}`,
    );
  };
  const selectedSession = week?.sessions.find(
    (session) => session.assignedDate === selectedDay,
  );

  return (
    <div className="space-y-6">
      {!isPast ? (
        <TrainingImport
          weekStart={selectedWeek}
          trainingByWeekday={trainingByWeekday}
        />
      ) : null}

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
                {week
                  ? `${week.plan.programa} · ${week.plan.etiqueta}`
                  : "Sin semana guardada"}
              </span>
            </span>
            <input
              type="date"
              value={selectedWeek}
              onChange={(event) =>
                event.target.value && navigate(event.target.value)
              }
              className="absolute inset-0 size-full cursor-pointer opacity-0 text-base"
              aria-label="Elegir semana por fecha"
            />
          </label>

          <button
            type="button"
            className="app-icon-button shrink-0"
            aria-label="Semana siguiente"
            onClick={() => navigate(shiftDayKey(selectedWeek, 7))}
          >
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1" aria-label="Días de la semana">
          {weekDates.map((date, index) => {
            const active = selectedDay === date;
            const hasSession = week?.sessions.some(
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
                    className={`absolute bottom-1.5 size-1 rounded-full ${
                      active ? "bg-primary-foreground" : "bg-protein"
                    }`}
                    aria-hidden
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedSession && week ? (
        <TrainingSessionDetail
          session={selectedSession}
          plan={week.plan}
          actions={
            <>
              {!isPast ? (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-[13px] font-semibold text-primary-foreground"
                >
                  <Pencil className="size-4" aria-hidden />
                  Editar sesión
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setWeekOpen(true)}
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-foreground ${
                  isPast ? "col-span-2" : ""
                }`}
              >
                <SlidersHorizontal className="size-4" aria-hidden />
                Semana
              </button>
            </>
          }
        />
      ) : (
        <section className="wellness-card p-6 text-center" aria-live="polite">
          <span className="mx-auto inline-flex size-11 items-center justify-center rounded-xl bg-surface-2 text-primary">
            <CalendarSearch className="size-5" aria-hidden />
          </span>
          <h2 className="mt-3 text-[14px] font-semibold text-foreground">
            Sin sesión para {labelForKey(selectedDay)}
          </h2>
          <p className="mx-auto mt-1 max-w-[30ch] text-[12px] leading-relaxed text-muted-foreground">
            {isPast
              ? "No consta entrenamiento para este día."
              : week
                ? "Puedes asignar una sesión pendiente desde Semana."
                : "Puedes importar la programación de esta semana."}
          </p>
          {!isPast ? (
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setAdding(true)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground"
              >
                <Plus className="size-4" aria-hidden />
                Añadir sesión
              </button>
              {week ? (
                <button
                  type="button"
                  onClick={() => setWeekOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-[13px] font-semibold text-foreground"
                >
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Semana
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      )}

      {selectedSession && week ? (
        <SessionEditorSheet
          key={selectedSession.id}
          open={editing}
          onOpenChange={setEditing}
          session={selectedSession}
          days={weekDates}
          trainingByWeekday={trainingByWeekday}
          onChanged={() => router.refresh()}
        />
      ) : null}

      {week ? (
        <WeekManagementSheet
          open={weekOpen}
          onOpenChange={setWeekOpen}
          week={week}
          days={weekDates}
          trainingByWeekday={trainingByWeekday}
          readOnly={isPast}
          onChanged={() => router.refresh()}
        />
      ) : null}

      <TrainingSessionComposer
        key={selectedDay}
        open={adding}
        onOpenChange={setAdding}
        date={selectedDay}
        trainingByWeekday={trainingByWeekday}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function SessionEditorSheet({
  open,
  onOpenChange,
  session,
  days,
  trainingByWeekday,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  session: TrainingWeekView["sessions"][number];
  days: string[];
  trainingByWeekday: TrainingByWeekday;
  onChanged: () => void;
}) {
  const [nombre, setNombre] = useState(session.nombre);
  const [tipo, setTipo] = useState<TrainingTipo>(session.tipo);
  const [contenido, setContenido] = useState(session.contenido);
  const [kcalMin, setKcalMin] = useState(
    session.kcalMin == null ? "" : String(session.kcalMin),
  );
  const [kcalMax, setKcalMax] = useState(
    session.kcalMax == null ? "" : String(session.kcalMax),
  );
  const [duracion, setDuracion] = useState(
    session.duracionMin == null ? "" : String(session.duracionMin),
  );
  const [assignment, setAssignment] = useState<TrainingAssignmentState>(
    session.franja
      ? {
          date: session.assignedDate ?? "",
          franja: session.franja,
          source: "manual",
        }
      : createTrainingAssignment(
          session.assignedDate ?? "",
          trainingByWeekday,
        ),
  );
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const save = async () => {
    if (!nombre.trim()) {
      toast.error("La sesión necesita nombre.");
      return;
    }
    if (assignment.date && !assignment.franja) {
      toast.error("Elige mañana o tarde para esta sesión.");
      return;
    }
    setBusy(true);
    try {
      await api.updateTrainingSession(session.id, {
        nombre: nombre.trim(),
        tipo,
        contenido,
        kcalMin: intOrNull(kcalMin),
        kcalMax: intOrNull(kcalMax),
        duracionMin: intOrNull(duracion),
        franja: assignment.franja,
      });
      const nextDate = assignment.date || null;
      if (nextDate !== session.assignedDate) {
        await api.reassignTrainingSession(
          session.id,
          nextDate,
          assignment.franja ?? undefined,
        );
      }
      toast.success("Sesión actualizada.");
      onOpenChange(false);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.deleteTrainingSession(session.id);
      toast.success("Sesión borrada.");
      setDeleteOpen(false);
      onOpenChange(false);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo borrar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar sesión</SheetTitle>
            <SheetDescription>
              El contenido completo sigue siendo la fuente canónica.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-6">
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
                rows={7}
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
              <label className="block">
                <span className="ui-label mb-1.5 block">Tipo</span>
                <Select
                  value={tipo}
                  onValueChange={(value) => setTipo(value as TrainingTipo)}
                >
                  <SelectTrigger className="min-h-11 w-full text-base">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRAINING_TIPOS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {TRAINING_TIPO_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <NumberInput
                label="Duración"
                suffix="min"
                value={duracion}
                onChange={setDuracion}
              />
              <NumberInput
                label="Gasto mínimo"
                suffix="kcal"
                value={kcalMin}
                onChange={setKcalMin}
              />
              <NumberInput
                label="Gasto máximo"
                suffix="kcal"
                value={kcalMax}
                onChange={setKcalMax}
              />
            </div>
            <label className="block">
              <span className="ui-label mb-1.5 block">Día</span>
              <Select
                value={assignment.date || NONE}
                onValueChange={(value) =>
                  setAssignment((current) =>
                    changeAssignmentDate(
                      current,
                      value === NONE ? "" : value,
                      trainingByWeekday,
                    ),
                  )
                }
              >
                <SelectTrigger className="min-h-11 w-full text-base">
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
            <FranjaSelect
              value={assignment.franja}
              disabled={!assignment.date}
              onChange={(franja) =>
                setAssignment((current) =>
                  overrideAssignmentFranja(current, franja),
                )
              }
            />
            <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-destructive/30 px-4 text-destructive"
                aria-label="Borrar sesión"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="min-h-12 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Guardando…" : "Guardar sesión"}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Borrar sesión"
        description={`Se borrará «${session.nombre}» y se limpiará su asignación del día.`}
        confirmLabel="Borrar sesión"
        busy={busy}
        onConfirm={remove}
      />
    </>
  );
}

function WeekManagementSheet({
  open,
  onOpenChange,
  week,
  days,
  trainingByWeekday,
  readOnly,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  week: TrainingWeekView;
  days: string[];
  trainingByWeekday: TrainingByWeekday;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const removeWeek = async () => {
    setBusyId(-1);
    try {
      await api.deleteTrainingPlan(week.plan.id);
      toast.success("Semana borrada.");
      setDeleteOpen(false);
      onOpenChange(false);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo borrar.",
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Semana</SheetTitle>
            <SheetDescription>
              {week.plan.programa} · {week.plan.etiqueta}
              {readOnly ? " · solo lectura" : " · asignación de sesiones"}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 px-4 pb-6">
            {week.sessions.map((session) => (
              <WeekAssignmentEditor
                key={session.id}
                session={session}
                days={days}
                trainingByWeekday={trainingByWeekday}
                readOnly={readOnly}
                onChanged={onChanged}
              />
            ))}
            {!readOnly ? (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-destructive/30 px-4 text-[13px] font-semibold text-destructive"
              >
                <Trash2 className="size-4" aria-hidden />
                Borrar semana
              </button>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Borrar semana de entrenamiento"
        description={`Se borrará «${week.plan.programa} · ${week.plan.etiqueta}» y sus sesiones.`}
        confirmLabel="Borrar semana"
        busy={busyId === -1}
        onConfirm={removeWeek}
      />
    </>
  );
}

function WeekAssignmentEditor({
  session,
  days,
  trainingByWeekday,
  readOnly,
  onChanged,
}: {
  session: TrainingWeekView["sessions"][number];
  days: string[];
  trainingByWeekday: TrainingByWeekday;
  readOnly: boolean;
  onChanged: () => void;
}) {
  const [assignment, setAssignment] = useState<TrainingAssignmentState>(
    session.franja
      ? {
          date: session.assignedDate ?? "",
          franja: session.franja,
          source: "manual",
        }
      : createTrainingAssignment(
          session.assignedDate ?? "",
          trainingByWeekday,
        ),
  );
  const [busy, setBusy] = useState(false);

  const persist = async (next: TrainingAssignmentState) => {
    setAssignment(next);
    if (next.date && !next.franja) {
      toast.info("Elige mañana o tarde para terminar la asignación.");
      return;
    }

    setBusy(true);
    try {
      await api.reassignTrainingSession(
        session.id,
        next.date || null,
        next.franja,
      );
      toast.success(next.date ? "Sesión asignada." : "Sesión desasignada.");
      onChanged();
    } catch (error) {
      setAssignment(
        session.franja
          ? {
              date: session.assignedDate ?? "",
              franja: session.franja,
              source: "manual",
            }
          : createTrainingAssignment(
              session.assignedDate ?? "",
              trainingByWeekday,
            ),
      );
      toast.error(
        error instanceof Error ? error.message : "No se pudo reasignar.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface-2 p-3">
      <p className="text-[13px] font-semibold text-foreground">
        <span className="text-muted-foreground">{session.key}</span>{" "}
        {session.nombre}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {TRAINING_TIPO_LABELS[session.tipo]}
      </p>
      {!readOnly ? (
        <div className="mt-2 grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
          <label className="block">
            <span className="ui-label mb-1.5 block">Asignar a</span>
            <Select
              value={assignment.date || NONE}
              onValueChange={(value) =>
                persist(
                  changeAssignmentDate(
                    assignment,
                    value === NONE ? "" : value,
                    trainingByWeekday,
                  ),
                )
              }
              disabled={busy}
            >
              <SelectTrigger className="min-h-11 w-full bg-surface text-base">
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
          <FranjaSelect
            value={assignment.franja}
            disabled={busy || !assignment.date}
            onChange={(franja) =>
              persist(overrideAssignmentFranja(assignment, franja))
            }
          />
        </div>
      ) : (
        <p className="mt-2 text-[12px] text-muted-foreground">
          {session.assignedDate
            ? `${labelForKey(session.assignedDate)}${session.franja ? ` · ${session.franja}` : ""}`
            : "Sin asignar"}
        </p>
      )}
    </div>
  );
}

function NumberInput({
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
          inputMode="decimal"
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "" || /^\d*[.,]?\d*$/.test(raw)) onChange(raw);
          }}
          className="num h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          aria-label={label}
        />
        <span className="text-[11px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}

function FranjaSelect({
  value,
  disabled = false,
  onChange,
}: {
  value: SessionFranja | null;
  disabled?: boolean;
  onChange: (value: SessionFranja) => void;
}) {
  return (
    <label className="block">
      <span className="ui-label mb-1.5 block">Franja</span>
      <Select
        value={value ?? NONE}
        onValueChange={(next) => onChange(next as SessionFranja)}
        disabled={disabled}
      >
        <SelectTrigger className="min-h-11 w-full text-base">
          <SelectValue
            placeholder={disabled ? "Asigna primero un día" : "Elige franja"}
          />
        </SelectTrigger>
        <SelectContent>
          {!value ? (
            <SelectItem value={NONE} disabled>
              Elige mañana o tarde
            </SelectItem>
          ) : null}
          <SelectItem value="mañana">Mañana</SelectItem>
          <SelectItem value="tarde">Tarde</SelectItem>
        </SelectContent>
      </Select>
    </label>
  );
}
