"use client";

import { Camera, Loader2, Trash2, WifiOff } from "lucide-react";
import { useState } from "react";
import {
  MiniInput,
  type VariantRow,
  VariantsEditor,
} from "./variants-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fileToAiFile } from "@/lib/ai-files";
import { api } from "@/lib/client-api";
import {
  DIET_IMPORT_ORIGIN_LABEL,
  type DietImportOrigin,
  type DietImportSource,
} from "@/lib/diet-import-reconciliation";
import type { LabelProductSaveState } from "@/lib/label-nutrition";
import {
  GRP_ORDER,
  type GrpKey,
  type MealKey,
  PRODUCT_UNITS,
  PRODUCT_UNIT_SUFFIX,
  type ProductUnit,
} from "@/lib/macros";
import type { LabelReadResult } from "@/server/ai/schemas";

export interface DietImportRow {
  key: string;
  meal: MealKey;
  grp: GrpKey;
  name: string;
  baseG: string;
  unit: ProductUnit;
  kcal: string;
  prot: string;
  carb: string;
  fat: string;
  variants: VariantRow[];
  origin: DietImportOrigin;
  selectedSourceKey: string;
  sources: DietImportSource[];
  unitExplicit: boolean;
  labelSave: LabelProductSaveState | null;
}

function originClass(origin: DietImportOrigin): string {
  if (origin === "label") return "bg-protein/10 text-protein";
  if (origin === "previous") return "bg-primary/10 text-primary";
  if (origin === "edited") return "bg-carb/10 text-carb";
  return "bg-surface-2 text-muted-foreground";
}

export function DietImportRowEditor({
  row,
  online,
  onPatch,
  onSelectSource,
  onReadLabel,
  onToggleProductSave,
  onRemove,
}: {
  row: DietImportRow;
  online: boolean;
  onPatch: (patch: Partial<DietImportRow>) => void;
  onSelectSource: (sourceKey: string) => void;
  onReadLabel: (result: LabelReadResult) => void;
  onToggleProductSave: () => void;
  onRemove: () => void;
}) {
  const [reading, setReading] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);

  const pickLabel = async (file: File | undefined) => {
    if (!file || !online || reading) return;
    setReading(true);
    setLabelError(null);
    try {
      const image = await fileToAiFile(file);
      const result = await api.readLabel([image]);
      onReadLabel(result);
    } catch (error) {
      // Visible y no destructivo: onReadLabel solo se ejecuta tras respuesta válida.
      setLabelError(
        error instanceof Error ? error.message : "No se pudo leer la etiqueta.",
      );
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex min-h-7 shrink-0 items-center rounded-full px-2.5 text-[11px] font-semibold ${originClass(row.origin)}`}
        >
          {DIET_IMPORT_ORIGIN_LABEL[row.origin]}
        </span>
        {row.sources.length > 1 ? (
          <Select value={row.selectedSourceKey} onValueChange={onSelectSource}>
            <SelectTrigger className="h-11 min-w-0 flex-1 text-base" aria-label="Cambiar origen">
              <SelectValue placeholder="Cambiar origen" />
            </SelectTrigger>
            <SelectContent>
              {row.sources.map((source) => (
                <SelectItem key={source.key} value={source.key}>
                  {source.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
        {row.variants.length === 0 ? (
          <label
            className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-line px-3 text-[12px] font-semibold ${
              online && !reading
                ? "cursor-pointer bg-surface-2 text-primary"
                : "bg-surface-2 text-muted-foreground opacity-60"
            }`}
            title={!online ? "Necesitas conexión para leer una etiqueta" : undefined}
          >
            {reading ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : !online ? (
              <WifiOff className="size-4" aria-hidden />
            ) : (
              <Camera className="size-4" aria-hidden />
            )}
            {reading ? "Leyendo…" : "Foto de etiqueta"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={!online || reading}
              onChange={(event) => {
                void pickLabel(event.target.files?.[0]);
                event.currentTarget.value = "";
              }}
            />
          </label>
        ) : null}
      </div>

      {!online && row.variants.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Sin conexión: Foto de etiqueta no está disponible.
        </p>
      ) : null}
      {labelError ? (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
          {labelError}
        </div>
      ) : null}

      {row.selectedSourceKey === "label-read" && row.labelSave ? (
        <div className="rounded-lg border border-protein/25 bg-protein/5 px-3 py-2.5">
          <label className="flex min-h-11 items-center gap-2 text-[13px] text-foreground">
            <input
              type="checkbox"
              checked={row.labelSave.enabled}
              disabled={!row.labelSave.complete}
              onChange={onToggleProductSave}
              className="size-4 accent-[var(--protein)]"
            />
            <span>
              {row.labelSave.productId != null ? "Actualizar" : "Guardar"}{" "}
              <strong>{row.labelSave.productName}</strong> en Mis productos
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {row.labelSave.complete
              ? row.labelSave.basis === "serving"
                ? "Usará la ración impresa que coincide con la pauta."
                : "Usará la base principal impresa en la etiqueta."
              : "La etiqueta no trae todos los valores: corrige la fila, pero no fijará un producto incompleto."}
          </p>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          value={row.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          placeholder="Nombre de la opción"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2.5 text-base outline-none focus-visible:border-ring"
          aria-label="Nombre"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar opción"
          className="app-icon-button shrink-0 border-0 bg-transparent hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
        <Select value={row.grp} onValueChange={(value) => onPatch({ grp: value as GrpKey })}>
          <SelectTrigger className="h-11 w-full text-base" aria-label="Grupo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRP_ORDER.map((group) => (
              <SelectItem key={group} value={group}>
                {group}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={row.unit}
          onValueChange={(value) => onPatch({ unit: value as ProductUnit })}
        >
          <SelectTrigger className="h-11 w-full text-base" aria-label="Unidad">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRODUCT_UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {PRODUCT_UNIT_SUFFIX[unit]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MiniInput
          label={PRODUCT_UNIT_SUFFIX[row.unit]}
          value={row.baseG}
          onChange={(value) => onPatch({ baseG: value })}
        />
      </div>
      {row.variants.length > 0 ? (
        <VariantsEditor
          variants={row.variants}
          onChange={(next) => onPatch({ variants: next })}
          baseG={row.baseG === "" ? null : Math.round(Number(row.baseG.replace(",", ".")))}
          onFlatten={() => {
            const first = row.variants[0];
            onPatch(
              first
                ? {
                    variants: [],
                    kcal: first.kcal,
                    prot: first.prot,
                    carb: first.carb,
                    fat: first.fat,
                  }
                : { variants: [] },
            );
          }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2 min-[380px]:grid-cols-4">
          <MiniInput label="kcal" value={row.kcal} onChange={(value) => onPatch({ kcal: value })} />
          <MiniInput label="P" value={row.prot} onChange={(value) => onPatch({ prot: value })} />
          <MiniInput label="C" value={row.carb} onChange={(value) => onPatch({ carb: value })} />
          <MiniInput label="F" value={row.fat} onChange={(value) => onPatch({ fat: value })} />
        </div>
      )}
    </div>
  );
}
