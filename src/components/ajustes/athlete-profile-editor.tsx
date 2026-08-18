"use client";

import * as React from "react";
import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import {
  type AthleteProfile,
  closeLesion,
  currentObjective,
  deriveAge,
  type Lesion,
  lesionesVigentes,
  lesionReviewDate,
} from "@/lib/profile";
import { randomUUID } from "@/lib/uuid";
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

/** Deporte, nivel, programa + días/semana (derivados, solo lectura). */
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
      </div>
      <p className="text-[12px] text-muted-foreground">
        Entrena {trainingDays} días/semana (derivado del patrón habitual).
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
  label?: string;
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
      {label ? (
        <span className="text-[13px] font-medium text-foreground">{label}</span>
      ) : null}
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

/** Suplementos: siguen siendo chips (una palabra por cosa). */
function SuplementosSection({ p, set }: { p: AthleteProfile; set: SetProfile }) {
  return (
    <Section title="Suplementos">
      <ChipEditor
        items={p.suplementos}
        emptyLabel="Ninguno."
        placeholder="Añadir suplemento…"
        onAdd={(v) => {
          const value = v.trim();
          if (!value || p.suplementos.includes(value)) return;
          set("suplementos", [...p.suplementos, value]);
        }}
        onRemove={(v) =>
          set(
            "suplementos",
            p.suplementos.filter((x) => x !== v),
          )
        }
      />
    </Section>
  );
}

/** Área de texto del perfil (capacidad: dos líneas de "qué SÍ y qué NO"). */
function PTextarea(props: React.ComponentProps<"textarea">) {
  return (
    <textarea
      rows={3}
      {...props}
      className={cn(
        "w-full rounded-lg border border-input bg-surface-2 px-3 py-2 text-base outline-none focus-visible:border-ring",
        props.className,
      )}
    />
  );
}

const CAPACIDAD_PLACEHOLDER =
  "NO: nada por encima de cabeza, press, kipping. SÍ: tirón horizontal, peso muerto, pierna, cardio sin brazos.";

/*
  Lesiones (F26 Fase 1): NO son chips, son EPISODIOS fechados con capacidad. Se
  cierran poniendo fecha, nunca borrando — mismo trato que `objetivos[]`. Las
  vigentes van arriba (son las que entran en el contexto de IA); las cerradas,
  plegadas debajo y en solo lectura.
*/
function LesionesSection({
  p,
  set,
  today,
}: {
  p: AthleteProfile;
  set: SetProfile;
  today: string;
}) {
  const lesiones = useMemo(() => p.lesiones ?? [], [p.lesiones]);
  const vigentes = useMemo(() => lesionesVigentes(p), [p]);
  const cerradas = useMemo(
    () =>
      lesiones
        .filter((l) => l.cerradaEl)
        .sort((a, b) => (b.cerradaEl ?? "").localeCompare(a.cerradaEl ?? "")),
    [lesiones],
  );

  const [adding, setAdding] = useState(false);
  const [zona, setZona] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [desde, setDesde] = useState(today);
  const [closing, setClosing] = useState<string | null>(null);
  const [closeDate, setCloseDate] = useState(today);

  const patch = (id: string, fields: Partial<Lesion>) =>
    set(
      "lesiones",
      lesiones.map((l) => (l.id === id ? { ...l, ...fields } : l)),
    );

  const add = () => {
    const z = zona.trim();
    if (!z) {
      toast.error("Escribe la zona (ej. hombro derecho).");
      return;
    }
    set("lesiones", [
      ...lesiones,
      {
        id: randomUUID(),
        zona: z,
        capacidad: capacidad.trim(),
        desde: desde || null,
        revisarEl: lesionReviewDate(desde || today),
      },
    ]);
    setAdding(false);
    setZona("");
    setCapacidad("");
    setDesde(today);
    toast.success("Lesión añadida — guarda el perfil para aplicarla.");
  };

  return (
    <Section title="Lesiones">
      <p className="text-[12px] text-muted-foreground">
        Lo que la IA necesita no es la zona, es la <b>capacidad</b>: qué puedes y
        qué no. Cerrar una lesión no la borra — pasa al historial.
      </p>

      {vigentes.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Ninguna vigente.</p>
      ) : (
        <div className="space-y-3">
          {vigentes.map((l) => (
            <div
              key={l.id}
              className="space-y-3 rounded-2xl border border-line bg-surface-2 p-3"
            >
              <Field label="Zona">
                <PInput
                  value={l.zona}
                  onChange={(e) => patch(l.id, { zona: e.target.value })}
                />
              </Field>
              <Field
                label="Capacidad"
                hint={
                  l.capacidad.trim()
                    ? undefined
                    : "Sin capacidad: la IA tendrá que suponer (y supondrá de más)."
                }
              >
                <PTextarea
                  value={l.capacidad}
                  onChange={(e) => patch(l.id, { capacidad: e.target.value })}
                  placeholder={CAPACIDAD_PLACEHOLDER}
                />
              </Field>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Desde"
                  hint={
                    l.desde
                      ? undefined
                      : "Sin fecha: no puede ordenarse en el Historial."
                  }
                >
                  <PInput
                    type="date"
                    value={l.desde ?? ""}
                    max={today}
                    onChange={(e) => patch(l.id, { desde: e.target.value || null })}
                  />
                </Field>
                <Field label="Revisar el">
                  <PInput
                    type="date"
                    value={l.revisarEl}
                    onChange={(e) =>
                      patch(l.id, { revisarEl: e.target.value || l.revisarEl })
                    }
                  />
                </Field>
              </div>

              {closing === l.id ? (
                <div className="space-y-2 border-t border-line pt-3">
                  <Field
                    label="¿Desde cuándo está bien?"
                    hint="Si no es de hoy, se guarda marcada como aproximada."
                  >
                    <PInput
                      type="date"
                      value={closeDate}
                      max={today}
                      onChange={(e) => setCloseDate(e.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        patch(l.id, closeLesion(l, closeDate || today, today));
                        setClosing(null);
                        toast.success("Lesión cerrada — guarda el perfil para aplicarlo.");
                      }}
                      className="min-h-11 flex-1 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                    >
                      Cerrar lesión
                    </button>
                    <button
                      type="button"
                      onClick={() => setClosing(null)}
                      className="min-h-11 rounded-xl border border-line px-3 text-sm text-muted-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setClosing(l.id);
                    setCloseDate(today);
                  }}
                  className="min-h-11 w-full rounded-xl border border-line text-[13px] font-semibold text-foreground"
                >
                  Ya está — cerrar lesión
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-line p-3">
          <Field label="Zona">
            <PInput
              value={zona}
              onChange={(e) => setZona(e.target.value)}
              placeholder="ej. hombro derecho"
            />
          </Field>
          <Field label="Capacidad">
            <PTextarea
              value={capacidad}
              onChange={(e) => setCapacidad(e.target.value)}
              placeholder={CAPACIDAD_PLACEHOLDER}
            />
          </Field>
          <Field
            label="Desde"
            hint={`Se revisará el ${lesionReviewDate(desde || today)}.`}
          >
            <PInput
              type="date"
              value={desde}
              max={today}
              onChange={(e) => setDesde(e.target.value)}
            />
          </Field>
          <button
            type="button"
            onClick={add}
            className="min-h-11 w-full rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
          >
            Añadir lesión
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="min-h-11 w-full rounded-xl border border-line bg-surface-2 px-4 text-sm font-semibold text-foreground"
        >
          + Declarar una lesión
        </button>
      )}

      {cerradas.length > 0 ? (
        <details className="text-sm">
          <summary className="flex min-h-11 cursor-pointer items-center text-[13px] font-medium text-muted-foreground">
            Cerradas ({cerradas.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {cerradas.map((l) => (
              <li key={l.id} className="text-[13px] text-foreground">
                <span className="font-medium">{l.zona}</span>
                <span className="num text-muted-foreground">
                  {" · "}
                  {l.desde ?? "?"} → {l.cerradaEl}
                  {l.cierreAproximado ? " (aprox.)" : ""}
                </span>
                {l.capacidad.trim() ? (
                  <p className="text-[12px] text-muted-foreground">{l.capacidad}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
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
      <SuplementosSection p={p} set={set} />
      <LesionesSection p={p} set={set} today={today} />
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
