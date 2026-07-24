"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import {
  type AthleteProfile,
  currentObjective,
  deriveAge,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Actualiza un campo del perfil conservando el resto (patch inmutable). */
type SetProfile = <K extends keyof AthleteProfile>(
  k: K,
  v: AthleteProfile[K],
) => void;

/** Input del perfil a 44px (target táctil 05-DISENO §4; hoy el base es 32px). */
function PInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn("h-11 text-base", className)} {...props} />;
}

/** Sub-sección con encabezado y separador fino (aire, no un muro de campos). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <h4 className="ui-label">
        {title}
      </h4>
      {children}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-[12px] text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

function Chips({
  items,
  onRemove,
  empty,
}: {
  items: string[];
  onRemove: (v: string) => void;
  empty: string;
}) {
  if (items.length === 0)
    return <p className="text-[13px] text-muted-foreground">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((v) => (
        <span
          key={v}
          className="inline-flex min-h-11 items-center overflow-hidden rounded-full bg-surface-2 pl-3 text-[13px] font-medium text-foreground ring-1 ring-line"
        >
          <span className="max-w-[12rem] truncate">{v}</span>
          <button
            type="button"
            onClick={() => onRemove(v)}
            aria-label={`Quitar ${v}`}
            className="ml-1 inline-flex size-11 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </span>
      ))}
    </div>
  );
}

/** Deporte, nivel, programa, franja + días/semana (derivados, solo lectura). */
function DeporteEntrenoSection({
  p,
  set,
  trainingDays,
}: {
  p: AthleteProfile;
  set: SetProfile;
  trainingDays: number;
}) {
  return (
    <Section title="Deporte y entreno">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Deporte">
          <PInput value={p.deporte} onChange={(e) => set("deporte", e.target.value)} />
        </Field>
        <Field label="Nivel">
          <PInput value={p.nivel} onChange={(e) => set("nivel", e.target.value)} />
        </Field>
        <Field label="Programa">
          <PInput value={p.programa} onChange={(e) => set("programa", e.target.value)} />
        </Field>
        <Field label="Franja de entreno">
          <PInput
            value={p.franjaEntreno}
            onChange={(e) => set("franjaEntreno", e.target.value)}
          />
        </Field>
      </div>
      <p className="text-[12px] text-muted-foreground">
        Entrena {trainingDays} días/semana (derivado del mapeo de sesiones).
      </p>
    </Section>
  );
}

/** Fecha de nacimiento (edad derivada), altura y nota clínica. */
function DatosSection({
  p,
  set,
  edad,
}: {
  p: AthleteProfile;
  set: SetProfile;
  edad: number | null;
}) {
  return (
    <Section title="Datos">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Fecha de nacimiento"
          hint={edad != null ? `${edad} años` : "edad no derivable"}
        >
          <PInput
            type="date"
            value={p.fechaNacimiento ?? ""}
            onChange={(e) => set("fechaNacimiento", e.target.value || null)}
          />
        </Field>
        <Field label="Altura (cm)">
          <PInput
            type="number"
            inputMode="numeric"
            value={p.alturaCm ?? ""}
            onChange={(e) =>
              set("alturaCm", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>
      <Field label="Nota clínica">
        <PInput
          value={p.notaClinica ?? ""}
          onChange={(e) => set("notaClinica", e.target.value || null)}
          placeholder="ej. le cuesta la grasa abdominal baja"
        />
      </Field>
    </Section>
  );
}

/** Fila de chips (suplemento o lesión) con input + botón para añadir. */
function ChipEditor({
  label,
  items,
  emptyLabel,
  placeholder,
  onAdd,
  onRemove,
}: {
  label: string;
  items: string[];
  emptyLabel: string;
  placeholder: string;
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [input, setInput] = useState("");
  const commit = () => {
    onAdd(input);
    setInput("");
  };
  return (
    <div className="space-y-1.5">
      <span className="text-[13px] font-medium text-foreground">{label}</span>
      <Chips items={items} onRemove={onRemove} empty={emptyLabel} />
      <div className="flex gap-2">
        <PInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={commit}
          className="h-11 shrink-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground hover:text-primary"
        >
          Añadir
        </button>
      </div>
    </div>
  );
}

/** Suplementos y lesiones como chips (input local en cada ChipEditor). */
function SuplementosLesionesSection({
  p,
  set,
}: {
  p: AthleteProfile;
  set: SetProfile;
}) {
  const lesiones = p.lesiones ?? [];
  const addUnique = (key: "suplementos" | "lesiones", list: string[], value: string) => {
    const v = value.trim();
    if (!v || list.includes(v)) return;
    set(key, [...list, v]);
  };
  return (
    <Section title="Suplementos y lesiones">
      <ChipEditor
        label="Suplementos"
        items={p.suplementos}
        emptyLabel="Ninguno."
        placeholder="Añadir suplemento…"
        onAdd={(v) => addUnique("suplementos", p.suplementos, v)}
        onRemove={(v) =>
          set(
            "suplementos",
            p.suplementos.filter((x) => x !== v),
          )
        }
      />
      <ChipEditor
        label="Lesiones"
        items={lesiones}
        emptyLabel="Ninguna."
        placeholder="Añadir lesión…"
        onAdd={(v) => addUnique("lesiones", lesiones, v)}
        onRemove={(v) =>
          set(
            "lesiones",
            lesiones.filter((x) => x !== v),
          )
        }
      />
    </Section>
  );
}

/*
  Objetivo (doc 10 A1): vigente destacado + "Cambiar objetivo" (añade entrada
  fechada) + historial plegado. El historial NUNCA se edita: cambiar = añadir.
  El formulario de cambio vive con su propio estado local aquí.
*/
function ObjetivoSection({
  p,
  set,
  today,
}: {
  p: AthleteProfile;
  set: SetProfile;
  today: string;
}) {
  const [changingObj, setChangingObj] = useState(false);
  const [objText, setObjText] = useState("");
  const [objDate, setObjDate] = useState(today);
  const [objPeso, setObjPeso] = useState("");

  const vigente = currentObjective(p);
  const historial = useMemo(
    () =>
      [...p.objetivos]
        .sort((a, b) => b.desde.localeCompare(a.desde))
        .filter((o) => o !== vigente),
    [p.objetivos, vigente],
  );

  const addObjective = () => {
    const texto = objText.trim();
    if (!texto) {
      toast.error("Escribe el objetivo.");
      return;
    }
    const pesoNum = objPeso.trim() ? Number(objPeso) : null;
    set("objetivos", [
      ...p.objetivos,
      {
        desde: objDate,
        texto,
        pesoObjetivo: pesoNum != null && Number.isFinite(pesoNum) ? pesoNum : null,
      },
    ]);
    setChangingObj(false);
    setObjText("");
    setObjPeso("");
    setObjDate(today);
    toast.success("Objetivo añadido — guarda el perfil para aplicarlo.");
  };

  return (
    <div className="space-y-3 rounded-2xl bg-primary-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">
          Objetivo vigente
        </span>
        <button
          type="button"
          onClick={() => setChangingObj((v) => !v)}
          className="min-h-11 shrink-0 rounded-xl px-2 text-[13px] font-semibold text-primary hover:bg-surface/70"
        >
          {changingObj ? "Cancelar" : "Cambiar objetivo"}
        </button>
      </div>
      {vigente ? (
        <p className="text-sm text-foreground">
          {vigente.texto}
          <span className="text-muted-foreground">
            {" "}
            · desde {vigente.desde}
            {vigente.pesoObjetivo != null
              ? ` · meta ${vigente.pesoObjetivo} kg`
              : ""}
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Sin objetivo definido.</p>
      )}

      {changingObj ? (
        <div className="space-y-3 border-t border-line pt-3">
          <Field label="Nuevo objetivo">
            <PInput
              value={objText}
              onChange={(e) => setObjText(e.target.value)}
              placeholder="ej. mantenimiento tras la competición"
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Desde">
              <PInput
                type="date"
                value={objDate}
                onChange={(e) => setObjDate(e.target.value)}
              />
            </Field>
            <Field label="Peso objetivo (kg, opcional)">
              <PInput
                type="number"
                inputMode="decimal"
                value={objPeso}
                onChange={(e) => setObjPeso(e.target.value)}
              />
            </Field>
          </div>
          <button
            type="button"
            onClick={addObjective}
            className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Añadir objetivo fechado
          </button>
        </div>
      ) : null}

      {historial.length > 0 ? (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-medium text-muted-foreground">
            Historial ({historial.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {historial.map((o) => (
              <li key={`${o.desde}-${o.texto}`} className="text-foreground">
                <span className="text-muted-foreground">{o.desde}:</span>{" "}
                {o.texto}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/*
  Perfil de atleta (doc 10 A1). Orquesta las secciones (deporte, datos, chips y
  objetivo) sobre un único estado `p`; cada sección recibe `p` + el patcher `set`.
  La edad se DERIVA de la fecha de nacimiento; los días de entreno/semana se
  DERIVAN del mapeo de sesiones (se muestran, no se editan aquí).
*/
export function AthleteProfileEditor({
  initial,
  today,
  trainingDays,
}: {
  initial: AthleteProfile;
  today: string;
  trainingDays: number;
}) {
  const [p, setP] = useState<AthleteProfile>(initial);
  const [saving, setSaving] = useState(false);

  const edad = deriveAge(p.fechaNacimiento, today);
  const set: SetProfile = (k, v) => setP((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.saveAthleteProfile(p);
      setP(res.profile);
      toast.success("Perfil guardado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <DeporteEntrenoSection p={p} set={set} trainingDays={trainingDays} />
      <DatosSection p={p} set={set} edad={edad} />
      <SuplementosLesionesSection p={p} set={set} />
      <ObjetivoSection p={p} set={set} today={today} />

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar perfil"}
      </button>
    </div>
  );
}
