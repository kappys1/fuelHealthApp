"use client";

import { Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { daysBetween, labelForKey, shiftDayKey } from "@/lib/dates";
import {
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
  TRAINING_TIPOS,
} from "@/lib/training";
import type { TrainingWeekView } from "@/server/db/queries/training";
import { TrainingImport } from "./training-import";

const NONE = "__none__";
const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));
const intOrNull = (s: string) => (s.trim() === "" ? null : Math.round(n(s)));

/** Días del periodo del plan (valid_from..valid_to inclusive) para reasignar. */
function planDays(validFrom: string, validTo: string | null): string[] {
  const end = validTo ?? validFrom;
  const span = Math.max(0, daysBetween(validFrom, end));
  return Array.from({ length: span + 1 }, (_, i) => shiftDayKey(validFrom, i));
}

export function TrainingWeek({ week }: { week: TrainingWeekView | null }) {
  const router = useRouter();

  if (!week) {
    return (
      <div className="space-y-4 pb-8">
        <TrainingImport />
        <div className="rounded-xl border border-dashed border-line bg-surface-2 p-6 text-center">
          <p className="text-sm text-foreground">
            Aún no has importado ninguna semana de entreno.
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Usa «Importar semana de entreno» para subir tu programación.
          </p>
        </div>
      </div>
    );
  }

  const { plan, sessions } = week;
  const days = planDays(plan.validFrom, plan.validTo);

  const deletePlan = async () => {
    if (
      !window.confirm(
        `¿Borrar la semana «${plan.programa} · ${plan.etiqueta}»? Los días registrados se conservan.`,
      )
    )
      return;
    try {
      await api.deleteTrainingPlan(plan.id);
      toast.success("Semana borrada.");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <TrainingImport />

      <section className="rounded-xl border border-line bg-surface shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-foreground">
              {plan.programa} · {plan.etiqueta}
            </h2>
            <p className="num text-[12px] text-muted-foreground">
              {labelForKey(plan.validFrom)}
              {plan.validTo ? ` – ${labelForKey(plan.validTo)}` : ""} ·{" "}
              {sessions.length} sesiones
            </p>
          </div>
          <button
            type="button"
            onClick={deletePlan}
            aria-label="Borrar semana"
            className="shrink-0 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        </div>

        <div className="divide-y divide-line">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              days={days}
              onChanged={() => router.refresh()}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function SessionCard({
  session,
  days,
  onChanged,
}: {
  session: TrainingWeekView["sessions"][number];
  days: string[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  const reassign = async (date: string | null) => {
    setBusy(true);
    try {
      await api.reassignTrainingSession(session.id, date);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo reasignar.");
    } finally {
      setBusy(false);
    }
  };

  if (editing) {
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
    <div className="space-y-2 px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium text-foreground">
            <span className="text-muted-foreground">{session.key}</span> {session.nombre}
          </div>
          <div className="num text-[12px] text-muted-foreground">
            {TRAINING_TIPO_LABELS[session.tipo]}
            {session.kcalMin != null || session.kcalMax != null
              ? ` · ${session.kcalMin ?? "?"}–${session.kcalMax ?? "?"} kcal`
              : ""}
            {session.duracionMin != null ? ` · ${session.duracionMin} min` : ""}
          </div>
          {session.contenido ? (
            <p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">
              {session.contenido}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Editar sesión"
          onClick={() => setEditing(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
      </div>

      <label className="flex items-center gap-2">
        <span className="text-[12px] text-muted-foreground">Día:</span>
        <Select
          value={session.assignedDate ?? NONE}
          onValueChange={(v) => reassign(v === NONE ? null : v)}
          disabled={busy}
        >
          <SelectTrigger className="h-9 flex-1 text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>Sin asignar</SelectItem>
            {days.map((d) => (
              <SelectItem key={d} value={d}>
                {labelForKey(d)}
              </SelectItem>
            ))}
            {session.assignedDate && !days.includes(session.assignedDate) ? (
              <SelectItem value={session.assignedDate}>
                {labelForKey(session.assignedDate)}
              </SelectItem>
            ) : null}
          </SelectContent>
        </Select>
      </label>
    </div>
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 bg-surface-2/50 px-4 py-3">
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la sesión"
        className="w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-base outline-none focus-visible:border-ring"
        aria-label="Nombre"
      />
      <textarea
        value={contenido}
        onChange={(e) => setContenido(e.target.value)}
        rows={2}
        placeholder="Contenido"
        className="w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-[13px] outline-none focus-visible:border-ring"
        aria-label="Contenido"
      />
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[11px] text-muted-foreground">Tipo</span>
          <Select value={tipo} onValueChange={(v) => setTipo(v as TrainingTipo)}>
            <SelectTrigger className="h-9 w-full text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRAINING_TIPO_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <MiniInput label="min" value={duracion} onChange={setDuracion} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <MiniInput label="kcal mín" value={kcalMin} onChange={setKcalMin} />
        <MiniInput label="kcal máx" value={kcalMax} onChange={setKcalMax} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}

function MiniInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1 rounded-lg border border-input bg-surface px-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" || /^[0-9]*$/.test(raw)) onChange(raw);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="num h-9 w-full min-w-0 bg-transparent text-center text-base outline-none"
        aria-label={label}
      />
    </label>
  );
}
