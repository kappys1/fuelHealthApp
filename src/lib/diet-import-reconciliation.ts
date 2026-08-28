import {
  scaledForStore,
  type GrpKey,
  type Macros,
  type MealKey,
  type PlanVariant,
  type ProductUnit,
} from "@/lib/macros";
import type { ProductDTO } from "@/server/db/queries/lookups";
import type { PlanOptionDTO } from "@/server/db/queries/plan";

export type DietImportOrigin =
  | "ai"
  | "previous"
  | "label"
  | "product"
  | "edited";

export const DIET_IMPORT_ORIGIN_LABEL: Record<DietImportOrigin, string> = {
  ai: "Estimación IA",
  previous: "Dieta anterior",
  label: "Etiqueta",
  product: "Mis productos",
  edited: "Editado",
};

export interface DietImportValues extends Macros {
  meal: MealKey;
  grp: GrpKey;
  name: string;
  baseG: number | null;
  unit: ProductUnit;
  variants: PlanVariant[];
}

export interface DietImportSource {
  key: string;
  origin: Exclude<DietImportOrigin, "edited">;
  label: string;
  values: DietImportValues;
  /** La unidad de F-IA-9 es desconocida y usa `g` solo como fallback de UI. */
  unitExplicit: boolean;
  productId?: number;
}

export interface ReconciledDietOption {
  selectedKey: string;
  origin: Exclude<DietImportOrigin, "edited">;
  values: DietImportValues;
  sources: DietImportSource[];
}

function cloneVariants(variants: readonly PlanVariant[]): PlanVariant[] {
  return variants.map((variant) => ({ ...variant }));
}

export function cloneDietImportValues(values: DietImportValues): DietImportValues {
  return { ...values, variants: cloneVariants(values.variants) };
}

/**
 * Clave conservadora para nombres de dieta/producto: ignora mayúsculas, acentos,
 * puntuación y espacios, pero conserva las palabras. No hace fuzzy matching.
 */
export function normalizeDietImportName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function containsWholePhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/**
 * Match de producto deliberadamente estrecho:
 *  1) nombre exacto normalizado y único;
 *  2) si no, el nombre COMPLETO de la opción dentro del nombre de un único producto.
 *
 * La dirección de la contención importa: «Gazpacho» puede proponer «Gazpacho Lidl»,
 * pero un producto corto dentro de «Café con leche y canela» nunca convierte en
 * silencio la preparación completa en ese ingrediente.
 */
export function findSafeDietProductMatch<T extends Pick<ProductDTO, "name">>(
  optionName: string,
  products: readonly T[],
): T | null {
  const optionKey = normalizeDietImportName(optionName);
  if (!optionKey) return null;

  const exact = products.filter(
    (product) => normalizeDietImportName(product.name) === optionKey,
  );
  if (exact.length === 1) return exact[0]!;
  if (exact.length > 1) return null;

  const contained = products.filter((product) =>
    containsWholePhrase(normalizeDietImportName(product.name), optionKey),
  );
  return contained.length === 1 ? contained[0]! : null;
}

/** Nombre exacto; si está repetido en la dieta anterior, exige misma comida. */
export function findPreviousDietOption(
  imported: Pick<DietImportValues, "name" | "meal">,
  previousOptions: readonly PlanOptionDTO[],
): PlanOptionDTO | null {
  const key = normalizeDietImportName(imported.name);
  const matches = previousOptions.filter(
    (option) => normalizeDietImportName(option.name) === key,
  );
  if (matches.length === 1) return matches[0]!;
  if (matches.length === 0) return null;

  const sameMeal = matches.filter((option) => option.meal === imported.meal);
  return sameMeal.length === 1 ? sameMeal[0]! : null;
}

function sourceMacros(values: Pick<DietImportValues, keyof Macros>): Macros {
  return {
    kcal: values.kcal,
    prot: values.prot,
    carb: values.carb,
    fat: values.fat,
  };
}

function scaledVariants(
  variants: readonly PlanVariant[],
  targetBaseG: number,
  sourceBaseG: number,
): PlanVariant[] {
  return variants.map((variant) => ({
    nombre: variant.nombre,
    ...scaledForStore(variant, targetBaseG, sourceBaseG),
  }));
}

function previousSource(
  imported: DietImportValues,
  importedUnitExplicit: boolean,
  previous: PlanOptionDTO,
): DietImportSource {
  const compatibleUnit = !importedUnitExplicit || imported.unit === previous.unit;
  const canScale =
    compatibleUnit &&
    imported.baseG != null &&
    imported.baseG > 0 &&
    previous.baseG != null &&
    previous.baseG > 0;
  const macros = canScale
    ? scaledForStore(previous, imported.baseG!, previous.baseG)
    : sourceMacros(previous);
  const variants = canScale
    ? scaledVariants(previous.variants, imported.baseG!, previous.baseG!)
    : cloneVariants(previous.variants);

  return {
    key: `previous:${previous.id}`,
    origin: "previous",
    label: DIET_IMPORT_ORIGIN_LABEL.previous,
    unitExplicit: true,
    values: {
      ...imported,
      baseG: canScale ? imported.baseG : previous.baseG,
      unit: previous.unit,
      ...macros,
      variants,
    },
  };
}

function productSource(
  imported: DietImportValues,
  importedUnitExplicit: boolean,
  product: ProductDTO,
): DietImportSource {
  const compatibleUnit = !importedUnitExplicit || imported.unit === product.unit;
  const canScale =
    compatibleUnit &&
    imported.baseG != null &&
    imported.baseG > 0 &&
    product.baseG != null &&
    product.baseG > 0;
  const targetBaseG = canScale ? imported.baseG : product.baseG;
  const macros = canScale
    ? scaledForStore(
        {
          kcal: product.baseKcal,
          prot: product.baseProt,
          carb: product.baseCarb,
          fat: product.baseFat,
        },
        imported.baseG!,
        product.baseG,
      )
    : {
        kcal: product.baseKcal,
        prot: product.baseProt,
        carb: product.baseCarb,
        fat: product.baseFat,
      };
  const origin = product.source === "etiqueta" ? "label" : "product";

  return {
    key: `product:${product.id}`,
    origin,
    label: `${DIET_IMPORT_ORIGIN_LABEL[origin]} · ${product.name}`,
    unitExplicit: true,
    productId: product.id,
    values: {
      ...imported,
      name: product.name,
      grp: product.grupo ?? imported.grp,
      baseG: targetBaseG,
      unit: product.unit,
      ...macros,
      variants: [],
    },
  };
}

/**
 * Construye todas las fuentes limpias de una fila y elige la automática con esta
 * precedencia: etiqueta segura > dieta anterior > F-IA-9. Los demás productos
 * quedan disponibles para selección explícita, pero nunca pisan por sí solos.
 */
export function reconcileDietImportOption(
  imported: DietImportValues,
  previousOptions: readonly PlanOptionDTO[],
  products: readonly ProductDTO[],
  options: { importedUnitExplicit?: boolean } = {},
): ReconciledDietOption {
  const importedUnitExplicit = options.importedUnitExplicit ?? false;
  const ai: DietImportSource = {
    key: "ai",
    origin: "ai",
    label: DIET_IMPORT_ORIGIN_LABEL.ai,
    unitExplicit: importedUnitExplicit,
    values: cloneDietImportValues(imported),
  };
  const sources: DietImportSource[] = [ai];

  const previous = findPreviousDietOption(imported, previousOptions);
  if (previous) {
    sources.push(previousSource(imported, importedUnitExplicit, previous));
  }

  // Un producto/etiqueta plano no puede sustituir un conjunto de variantes.
  if (imported.variants.length === 0) {
    for (const product of products) {
      sources.push(productSource(imported, importedUnitExplicit, product));
    }
  }

  const automaticProduct =
    imported.variants.length === 0
      ? findSafeDietProductMatch(
          imported.name,
          products.filter((product) => product.source === "etiqueta"),
        )
      : null;
  const selected = automaticProduct
    ? sources.find((source) => source.key === `product:${automaticProduct.id}`)!
    : previous
      ? sources.find((source) => source.key === `previous:${previous.id}`)!
      : ai;

  return {
    selectedKey: selected.key,
    origin: selected.origin,
    values: cloneDietImportValues(selected.values),
    sources,
  };
}

/** Restaura una copia limpia; editar el resultado nunca contamina la fuente. */
export function selectDietImportSource(
  row: Pick<ReconciledDietOption, "sources">,
  sourceKey: string,
): { source: DietImportSource; values: DietImportValues } | null {
  const source = row.sources.find((candidate) => candidate.key === sourceKey);
  if (!source) return null;
  return { source, values: cloneDietImportValues(source.values) };
}
