"use client";

import { Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import type { PlanVariant, VariantDraft } from "@/lib/macros";
import { displayMacro } from "@/lib/macros";

// Variante EN EDICIÓN: campos como STRING (igual que `VariantDraft`) para que los
// inputs no salten al teclear; se convierten a número al guardar (deriveVariantsForStore).
// `vid` = key estable de React (evita que borrar una variante robe el foco de otra).
export interface VariantRow extends VariantDraft {
  vid: string;
}

let varSeq = 0;
const varKey = () => `v${varSeq++}`;

/** Crea una fila de variante vacía con key estable. */
export function newVariantRow(): VariantRow {
  return { vid: varKey(), nombre: "", kcal: "", prot: "", carb: "", fat: "" };
}

/** Convierte una variante persistida (números) en fila editable (strings). */
export function planVariantToRow(v: PlanVariant): VariantRow {
  return {
    vid: varKey(),
    nombre: v.nombre,
    kcal: String(Math.round(v.kcal)),
    prot: String(displayMacro(v.prot)),
    carb: String(displayMacro(v.carb)),
    fat: String(displayMacro(v.fat)),
  };
}

/**
 * Editor de variantes intercambiables (F08). Fuente ÚNICA compartida por la vista
 * previa del import (`diet-import`) y el editor del plan (`OptionForm`): renombrar,
 * editar macros, quitar, añadir y «Sin variantes» (aplanar a opción normal). La 1ª
 * variante es el default al registrar. El aplanado lo maneja el llamador (`onFlatten`)
 * porque los campos planos viven en su propio estado en cada consumidor.
 */
export function VariantsEditor({
  variants,
  onChange,
  onFlatten,
  baseG,
}: {
  variants: VariantRow[];
  onChange: (next: VariantRow[]) => void;
  onFlatten: () => void;
  // Gramos pautados del hueco, comunes a todas las variantes (F08). Se pasan a
  // F-IA-3 al estimar los macros de una variante (F09). null = ración.
  baseG: number | null;
}) {
  // Spinner por-variante mientras estima con IA (F09): set de vids en vuelo.
  const [estimating, setEstimating] = useState<Set<string>>(new Set());

  const updateVar = (vid: string, patch: Partial<VariantRow>) =>
    onChange(variants.map((v) => (v.vid === vid ? { ...v, ...patch } : v)));
  const removeVar = (vid: string) =>
    onChange(variants.filter((v) => v.vid !== vid));
  const addVar = () => onChange([...variants, newVariantRow()]);

  // F09 · estima kcal/P/C/F de UNA variante reusando F-IA-3 (`estimatePlanOption`)
  // sin tocar el prompt. Del retorno se usan SOLO los macros; el `grupo` es del
  // hueco (la opción), no de la variante → se ignora. Escribe en el mismo formato
  // string que el resto del editor (kcal entera, macros con `displayMacro`).
  const estimateVar = async (v: VariantRow) => {
    if (!v.nombre.trim()) {
      toast.error("Escribe primero el nombre de la variante.");
      return;
    }
    setEstimating((s) => new Set(s).add(v.vid));
    try {
      const r = await api.estimatePlanOption(v.nombre.trim(), baseG);
      updateVar(v.vid, {
        kcal: String(Math.round(r.kcal)),
        prot: String(displayMacro(r.proteina_g)),
        carb: String(displayMacro(r.carbohidratos_g)),
        fat: String(displayMacro(r.grasa_g)),
      });
      toast("Estimado con IA. Revisa y guarda.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo estimar.");
    } finally {
      setEstimating((s) => {
        const next = new Set(s);
        next.delete(v.vid);
        return next;
      });
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-primary">
          {variants.length} variantes · eliges la fuente al registrar
        </span>
        <button
          type="button"
          onClick={onFlatten}
          className="min-h-11 rounded-lg px-2 text-[11px] font-semibold text-muted-foreground underline underline-offset-2"
        >
          Sin variantes
        </button>
      </div>
      {variants.map((v) => (
        <div key={v.vid} className="space-y-2 rounded-xl bg-surface/70 p-2.5">
          <div className="flex items-center gap-2">
            <input
              value={v.nombre}
              onChange={(e) => updateVar(v.vid, { nombre: e.target.value })}
              placeholder="Variante (p. ej. Pollo)"
              className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2.5 text-base outline-none focus-visible:border-ring"
              aria-label="Nombre de la variante"
            />
            <button
              type="button"
              onClick={() => estimateVar(v)}
              disabled={estimating.has(v.vid)}
              aria-label="Estimar macros de la variante con IA"
              className="app-icon-button shrink-0 border-0 bg-surface-2 text-primary disabled:opacity-60"
            >
              {estimating.has(v.vid) ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
            </button>
            <button
              type="button"
              onClick={() => removeVar(v.vid)}
              aria-label="Quitar variante"
              className="app-icon-button shrink-0 border-0 bg-surface-2 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-4" aria-hidden />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
            <MiniInput label="kcal" value={v.kcal} onChange={(x) => updateVar(v.vid, { kcal: x })} />
            <MiniInput label="P" value={v.prot} onChange={(x) => updateVar(v.vid, { prot: x })} />
            <MiniInput label="C" value={v.carb} onChange={(x) => updateVar(v.vid, { carb: x })} />
            <MiniInput label="F" value={v.fat} onChange={(x) => updateVar(v.vid, { fat: x })} />
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addVar}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-primary"
      >
        <Plus className="size-3.5" aria-hidden /> Añadir variante
      </button>
    </div>
  );
}

export function MiniInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-1 rounded-lg border border-input bg-surface px-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" || /^[0-9]*[.,]?[0-9]*$/.test(raw)) onChange(raw);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="num h-11 w-full min-w-0 bg-transparent text-center text-base outline-none"
        aria-label={label}
      />
    </label>
  );
}
