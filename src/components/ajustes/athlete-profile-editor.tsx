"use client";

import * as React from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import {
  type AthleteProfile,
  currentObjective,
  deriveAge,
} from "@/lib/profile";
import { cn } from "@/lib/utils";

/** Input del perfil a 44px (target táctil 05-DISENO §4; hoy el base es 32px). */
function PInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  return <Input className={cn("h-11", className)} {...props} />;
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
      <h4 className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  );
}

/*
  Perfil de atleta (doc 10 A1). Campos simples + suplementos/lesiones como chips +
  sección Objetivo (vigente destacado, "Cambiar objetivo" añade entrada fechada, e
  historial plegado). La edad se DERIVA de la fecha de nacimiento; los días de
  entreno/semana se DERIVAN del mapeo de sesiones (se muestran, no se editan aquí).
  El historial de objetivos no se edita nunca: cambiar = añadir entrada nueva.
*/

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
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <Badge key={v} variant="secondary" className="gap-1 pr-1">
          {v}
          <button
            type="button"
            onClick={() => onRemove(v)}
            aria-label={`Quitar ${v}`}
            className="ml-0.5 rounded-full px-1 text-muted-foreground hover:text-destructive"
          >
            ×
          </button>
        </Badge>
      ))}
    </div>
  );
}

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
  const [suplInput, setSuplInput] = useState("");
  const [lesionInput, setLesionInput] = useState("");
  const [changingObj, setChangingObj] = useState(false);
  const [objText, setObjText] = useState("");
  const [objDate, setObjDate] = useState(today);
  const [objPeso, setObjPeso] = useState("");

  const edad = deriveAge(p.fechaNacimiento, today);
  const vigente = currentObjective(p);
  const historial = useMemo(
    () =>
      [...p.objetivos]
        .sort((a, b) => b.desde.localeCompare(a.desde))
        .filter((o) => o !== vigente),
    [p.objetivos, vigente],
  );

  const set = <K extends keyof AthleteProfile>(
    k: K,
    v: AthleteProfile[K],
  ) => setP((prev) => ({ ...prev, [k]: v }));

  const lesiones = p.lesiones ?? [];

  const addChip = (
    input: string,
    list: string[],
    key: "suplementos" | "lesiones",
    clear: () => void,
  ) => {
    const v = input.trim();
    clear();
    if (!v || list.includes(v)) return;
    set(key, [...list, v]);
  };

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
      <Section title="Deporte y entreno">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Deporte">
            <PInput
              value={p.deporte}
              onChange={(e) => set("deporte", e.target.value)}
            />
          </Field>
          <Field label="Nivel">
            <PInput
              value={p.nivel}
              onChange={(e) => set("nivel", e.target.value)}
            />
          </Field>
          <Field label="Programa">
            <PInput
              value={p.programa}
              onChange={(e) => set("programa", e.target.value)}
            />
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

      <Section title="Datos">
        <div className="grid grid-cols-2 gap-4">
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
                set(
                  "alturaCm",
                  e.target.value === "" ? null : Number(e.target.value),
                )
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

      <Section title="Suplementos y lesiones">
        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">
            Suplementos
          </span>
          <Chips
            items={p.suplementos}
            onRemove={(v) =>
              set(
                "suplementos",
                p.suplementos.filter((x) => x !== v),
              )
            }
            empty="Ninguno."
          />
          <div className="flex gap-2">
            <PInput
              value={suplInput}
              onChange={(e) => setSuplInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChip(suplInput, p.suplementos, "suplementos", () =>
                    setSuplInput(""),
                  );
                }
              }}
              placeholder="Añadir suplemento…"
            />
            <button
              type="button"
              onClick={() =>
                addChip(suplInput, p.suplementos, "suplementos", () =>
                  setSuplInput(""),
                )
              }
              className="h-11 shrink-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground hover:text-primary"
            >
              Añadir
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <span className="text-[13px] font-medium text-foreground">Lesiones</span>
          <Chips
            items={lesiones}
            onRemove={(v) =>
              set(
                "lesiones",
                lesiones.filter((x) => x !== v),
              )
            }
            empty="Ninguna."
          />
          <div className="flex gap-2">
            <PInput
              value={lesionInput}
              onChange={(e) => setLesionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addChip(lesionInput, lesiones, "lesiones", () =>
                    setLesionInput(""),
                  );
                }
              }}
              placeholder="Añadir lesión…"
            />
            <button
              type="button"
              onClick={() =>
                addChip(lesionInput, lesiones, "lesiones", () =>
                  setLesionInput(""),
                )
              }
              className="h-11 shrink-0 rounded-lg border border-line bg-surface-2 px-3 text-sm text-foreground hover:text-primary"
            >
              Añadir
            </button>
          </div>
        </div>
      </Section>

      {/* Objetivo (doc 10 A1): vigente destacado + cambiar + historial plegado. */}
      <div className="space-y-2 rounded-lg border border-line bg-surface-2 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[13px] font-medium text-foreground">
            Objetivo vigente
          </span>
          <button
            type="button"
            onClick={() => setChangingObj((v) => !v)}
            className="text-[13px] text-primary hover:underline"
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
            <div className="grid grid-cols-2 gap-4">
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
              className="w-full rounded-lg bg-primary py-2 text-sm font-semibold text-primary-foreground"
            >
              Añadir objetivo fechado
            </button>
          </div>
        ) : null}

        {historial.length > 0 ? (
          <details className="text-sm">
            <summary className="cursor-pointer text-[13px] text-muted-foreground">
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

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {saving ? "Guardando…" : "Guardar perfil"}
      </button>
    </div>
  );
}
