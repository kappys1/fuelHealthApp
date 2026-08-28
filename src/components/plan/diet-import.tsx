"use client";

import {
  ArrowRight,
  FileUp,
  Loader2,
  Plus,
  Sparkles,
  Upload,
  WifiOff,
} from "lucide-react";
import { planVariantToRow } from "./variants-editor";
import {
  DietImportRowEditor,
  type DietImportRow,
} from "./diet-import-row";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Stepper } from "@/components/ui/stepper";
import { fileToAiFile } from "@/lib/ai-files";
import { api } from "@/lib/client-api";
import { dayKey } from "@/lib/dates";
import {
  deriveVariantsForStore,
  GRP_ORDER,
  type GrpKey,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
} from "@/lib/macros";
import {
  findSafeDietProductMatch,
  reconcileDietImportOption,
  selectDietImportSource,
  type DietImportSource,
  type DietImportValues,
} from "@/lib/diet-import-reconciliation";
import {
  applyLabelNutritionToDiet,
  buildLabelProductWrite,
  isCompleteLabelNutrition,
  selectLabelNutrition,
} from "@/lib/label-nutrition";
import { useOnline } from "@/lib/use-online";
import type { DietImportResult, LabelReadResult } from "@/server/ai/schemas";
import type { ProductDTO } from "@/server/db/queries/lookups";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));
const MAX_FILES = 4;

type Row = DietImportRow;

let rowSeq = 0;
const rowKey = () => `r${rowSeq++}`;

/** Normaliza el nombre de comida de la pauta a nuestras claves fijas. */
function toMeal(s: string): MealKey {
  const t = s.toLowerCase();
  if (t.includes("desayuno") || t.includes("almuerzo") || t.includes("mañana"))
    return "almuerzo";
  if (t.includes("comida") || t.includes("almorzar")) return "comida";
  if (t.includes("merienda") || t.includes("media tarde")) return "merienda";
  if (t.includes("cena")) return "cena";
  return "extra";
}

const noAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function toGrp(s: string): GrpKey {
  const found = GRP_ORDER.find((g) => noAccents(g) === noAccents(s));
  return found ?? "Opción única";
}

function variantToImportRow(
  variant: DietImportValues["variants"][number],
): DietImportRow["variants"][number] {
  const row = planVariantToRow(variant);
  return {
    ...row,
    kcal: String(Math.round(variant.kcal)),
    prot: String(variant.prot),
    carb: String(variant.carb),
    fat: String(variant.fat),
  };
}

function rowValues(row: Row): DietImportValues {
  const { variants, flat } = deriveVariantsForStore(row.variants);
  return {
    meal: row.meal,
    grp: row.grp,
    name: row.name.trim(),
    baseG: row.baseG === "" ? null : Math.round(n(row.baseG)),
    unit: row.unit,
    kcal: flat ? flat.kcal : Math.round(n(row.kcal)),
    prot: flat ? flat.prot : n(row.prot),
    carb: flat ? flat.carb : n(row.carb),
    fat: flat ? flat.fat : n(row.fat),
    variants,
  };
}

function valuesPatch(values: DietImportValues): Pick<
  Row,
  "meal" | "grp" | "name" | "baseG" | "unit" | "kcal" | "prot" | "carb" | "fat" | "variants"
> {
  return {
    meal: values.meal,
    grp: values.grp,
    name: values.name,
    baseG: values.baseG != null ? String(values.baseG) : "",
    unit: values.unit,
    kcal: String(Math.round(values.kcal)),
    prot: String(values.prot),
    carb: String(values.carb),
    fat: String(values.fat),
    variants: values.variants.map(variantToImportRow),
  };
}

export function DietImport({
  previousOptions,
  products,
}: {
  previousOptions: PlanOptionDTO[];
  products: ProductDTO[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wellness-card group flex min-h-[86px] w-full items-center gap-3 border border-primary/20 p-5 text-left transition-colors hover:border-primary/40"
      >
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <FileUp className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            Importar dieta (foto/PDF)
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
            Reconstruye el plan completo desde tu pauta. Revisas antes de guardar.
          </span>
        </span>
        <ArrowRight className="size-[18px] shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
      {open ? (
        <ImportSheet
          previousOptions={previousOptions}
          products={products}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ImportSheet({
  previousOptions,
  products,
  onClose,
}: {
  previousOptions: PlanOptionDTO[];
  products: ProductDTO[];
  onClose: () => void;
}) {
  const router = useRouter();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState(dayKey);
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  const pick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).slice(0, MAX_FILES));
  };

  const analyze = async () => {
    if (files.length === 0) {
      toast.error("Elige una foto o PDF de tu pauta.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const payload = await Promise.all(files.map(fileToAiFile));
      const result: DietImportResult = await api.importDiet(payload);
      applyResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar.");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyResult = (r: DietImportResult) => {
    if (r.kcal_totales != null) setKcal(String(Math.round(r.kcal_totales)));
    if (r.proteina_total != null) setProt(String(Math.round(r.proteina_total)));
    const next: Row[] = [];
    for (const comida of r.comidas) {
      const meal = toMeal(comida.comida);
      for (const o of comida.opciones) {
        const imported: DietImportValues = {
          meal,
          grp: toGrp(o.grupo),
          name: o.nombre,
          baseG: o.gramos != null ? Math.round(o.gramos) : null,
          // F-IA-9 no lee unidad (y su prompt sigue congelado): `g` es solo el
          // fallback de la estimación. Dieta anterior/productos aportan la real.
          unit: "g",
          kcal: Math.round(o.kcal),
          prot: o.proteina_g,
          carb: o.carbohidratos_g,
          fat: o.grasa_g,
          variants: o.variantes.map((v) => ({
            nombre: v.nombre,
            kcal: v.kcal,
            prot: v.proteina_g,
            carb: v.carbohidratos_g,
            fat: v.grasa_g,
          })),
        };
        // F27 Fase 1: toda la precedencia y aritmética vive en la función pura.
        // La UI recibe copias limpias y solo gestiona selección/edición.
        const reconciled = reconcileDietImportOption(
          imported,
          previousOptions,
          products,
        );
        next.push({
          key: rowKey(),
          ...valuesPatch(reconciled.values),
          origin: reconciled.origin,
          selectedSourceKey: reconciled.selectedKey,
          sources: reconciled.sources,
          unitExplicit:
            reconciled.sources.find((source) => source.key === reconciled.selectedKey)
              ?.unitExplicit ?? false,
          labelSave: null,
        });
      }
    }
    setRows(next);
    if (next.length === 0) {
      toast.error("No se detectaron opciones. Prueba con una foto más nítida.");
    }
  };

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows(
      (rs) =>
        rs?.map((r) =>
          r.key === key
            ? {
                ...r,
                ...patch,
                origin: "edited",
                unitExplicit: patch.unit != null ? true : r.unitExplicit,
              }
            : r,
        ) ?? null,
    );
  const selectSource = (key: string, sourceKey: string) =>
    setRows(
      (rs) =>
        rs?.map((row) => {
          if (row.key !== key) return row;
          const selected = selectDietImportSource(row, sourceKey);
          if (!selected) return row;
          return {
            ...row,
            ...valuesPatch(selected.values),
            selectedSourceKey: selected.source.key,
            origin: selected.source.origin,
            unitExplicit: selected.source.unitExplicit,
          };
        }) ?? null,
    );
  const applyLabel = (key: string, label: LabelReadResult) =>
    setRows(
      (currentRows) =>
        currentRows?.map((row) => {
          if (row.key !== key) return row;

          const current = rowValues(row);
          const choice = selectLabelNutrition(
            label,
            current.baseG,
            row.unitExplicit ? current.unit : null,
          );
          const values = applyLabelNutritionToDiet(
            current,
            label,
            choice,
            toGrp(label.grupo),
          );
          const selectedProductId = row.sources.find(
            (source) => source.key === row.selectedSourceKey,
          )?.productId;
          const product =
            products.find((candidate) => candidate.id === selectedProductId) ??
            findSafeDietProductMatch(label.nombre, products) ??
            findSafeDietProductMatch(current.name, products);
          const source: DietImportSource = {
            key: "label-read",
            origin: "label",
            label: "Etiqueta · Foto",
            values,
            unitExplicit: true,
            ...(product ? { productId: product.id } : {}),
          };
          return {
            ...row,
            ...valuesPatch(values),
            selectedSourceKey: source.key,
            origin: source.origin,
            unitExplicit: true,
            sources: [
              ...row.sources.filter((candidate) => candidate.key !== source.key),
              source,
            ],
            labelSave: {
              enabled: isCompleteLabelNutrition(choice),
              complete: isCompleteLabelNutrition(choice),
              productId: product?.id ?? null,
              productName: product?.name ?? (label.nombre.trim() || current.name),
              basis: choice.basis,
            },
          };
        }) ?? null,
    );
  const toggleLabelSave = (key: string) =>
    setRows(
      (currentRows) =>
        currentRows?.map((row) =>
          row.key === key && row.labelSave?.complete
            ? {
                ...row,
                labelSave: { ...row.labelSave, enabled: !row.labelSave.enabled },
              }
            : row,
        ) ?? null,
    );
  const removeRow = (key: string) =>
    setRows((rs) => rs?.filter((r) => r.key !== key) ?? null);
  const addRow = (meal: MealKey) =>
    setRows((rs) => [
      ...(rs ?? []),
      {
        key: rowKey(),
        meal,
        grp: "Opción única",
        name: "",
        baseG: "",
        unit: "g",
        kcal: "",
        prot: "",
        carb: "",
        fat: "",
        variants: [],
        origin: "edited",
        selectedSourceKey: "edited",
        sources: [],
        unitExplicit: true,
        labelSave: null,
      },
    ]);

  const save = async () => {
    if (!rows) return;
    const valid = rows.filter((r) => r.name.trim() !== "");
    if (valid.length === 0) {
      toast.error("La versión necesita al menos una opción con nombre.");
      return;
    }
    if (n(kcal) <= 0 || n(prot) <= 0) {
      toast.error("Revisa las kcal y la proteína totales.");
      return;
    }
    setSaving(true);
    try {
      await api.createDietVersion({
        effectiveFrom,
        kcal: Math.round(n(kcal)),
        prot: n(prot),
        carb: null,
        fat: null,
        options: valid.map(rowValues),
      });

      // La versión es el guardado primario. El segundo destino reutiliza la MISMA
      // lectura después, sin una llamada de IA adicional. Un fallo del catálogo no
      // invita a reintentar y duplicar una versión ya creada: se informa por separado.
      const writes = valid
        .map((row) =>
          buildLabelProductWrite(rowValues(row), row.selectedSourceKey, row.labelSave),
        )
        .filter((write) => write != null);
      const productResults = await Promise.allSettled(
        writes.map((write) =>
          write.productId != null
            ? api.updateProduct(write.productId, write.fields)
            : api.createProduct({ ...write.fields, pinned: true }),
        ),
      );
      const failedProducts = productResults.filter(
        (result) => result.status === "rejected",
      );
      if (failedProducts.length > 0) {
        const first = failedProducts[0];
        const detail =
          first?.status === "rejected" && first.reason instanceof Error
            ? first.reason.message
            : "error desconocido";
        toast.error(
          `Dieta creada, pero ${failedProducts.length} producto(s) no se actualizaron: ${detail}`,
        );
      } else {
        toast.success(
          writes.length > 0
            ? "Nueva dieta y Mis productos actualizados."
            : "Nueva versión de dieta creada.",
        );
      }
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la versión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Importar dieta (foto/PDF)</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Selección de archivos */}
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={(e) => pick(e.target.files)}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 px-3 text-[14px] text-foreground"
            >
              <Upload className="size-4 text-primary" aria-hidden />
              {files.length > 0
                ? `${files.length} archivo${files.length > 1 ? "s" : ""} · cambiar`
                : "Elegir foto(s) o PDF"}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hasta {MAX_FILES} páginas. Nada se guarda hasta que confirmes.
            </p>
          </div>

          {rows == null ? (
            <>
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || files.length === 0 || !online}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando la
                    pauta…
                  </>
                ) : !online ? (
                  <>
                    <WifiOff className="size-4" aria-hidden /> Sin conexión
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden /> Analizar con IA
                  </>
                )}
              </button>
              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
                  {error}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Objetivos detectados */}
              <section className="rounded-xl border border-line bg-surface p-3">
                <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">
                  Objetivos pautados (detectados)
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="kcal">
                    <Stepper value={kcal} onChange={setKcal} step={10} ariaLabel="kcal totales" />
                  </Field>
                  <Field label="Proteína">
                    <Stepper value={prot} onChange={setProt} step={5} suffix="g" ariaLabel="Proteína total" />
                  </Field>
                  <div className="col-span-2">
                    <Field label="Vigente desde">
                      <input
                        type="date"
                        value={effectiveFrom}
                        onChange={(e) => setEffectiveFrom(e.target.value)}
                        className="num h-11 w-full rounded-lg border border-input bg-surface px-2 text-base outline-none focus-visible:border-ring"
                        aria-label="Vigente desde"
                      />
                    </Field>
                  </div>
                </div>
              </section>

              {/* Opciones por comida (editable) */}
              {MEAL_ORDER.map((meal) => {
                const mealRows = rows.filter((r) => r.meal === meal);
                if (meal === "extra" && mealRows.length === 0) return null;
                return (
                  <section key={meal} className="rounded-xl border border-line bg-surface">
                    <div className="flex items-center justify-between border-b border-line px-3 py-2">
                      <h3 className="text-[13px] font-semibold text-foreground">
                        {MEAL_LABELS[meal]}
                      </h3>
                      <button
                        type="button"
                        onClick={() => addRow(meal)}
                        aria-label={`Añadir opción a ${MEAL_LABELS[meal]}`}
                        className="app-icon-button border-0 bg-surface-2 text-primary"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="divide-y divide-line">
                      {mealRows.length === 0 ? (
                        <p className="px-3 py-2 text-[12px] text-muted-foreground">
                          Sin opciones.
                        </p>
                      ) : (
                        mealRows.map((r) => (
                          <DietImportRowEditor
                            key={r.key}
                            row={r}
                            online={online}
                            onPatch={(p) => patchRow(r.key, p)}
                            onSelectSource={(sourceKey) => selectSource(r.key, sourceKey)}
                            onReadLabel={(result) => applyLabel(r.key, result)}
                            onToggleProductSave={() => toggleLabelSave(r.key)}
                            onRemove={() => removeRow(r.key)}
                          />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="min-h-11 w-full rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Creando…" : "Crear versión de dieta"}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
