import type { EntryInput, ProductInput } from "@/lib/client-api";
import type { EntryDTO } from "@/server/db/queries/day";
import type { ProductDTO } from "@/server/db/queries/lookups";

/*
  F13 · Derivaciones PURAS de las acciones de una entrada (Alcance B y C). Sin BD ni
  red: la UI de meal-row las usa y las escrituras van por use-today/api. Se testean
  aparte de la UI (regla de la casa: lógica antes que componente).
*/

// Fuentes de entrada que representan una estimación (IA / foto / estimador). Al
// promover a «Mis productos» nacen como `estimado`; cualquier otra fuente (plan,
// fav, plantilla, manual, legacy…) → `manual`. Regla congelada en la spec F13 §C.
const ESTIMATED_SOURCES = new Set(["ia", "foto", "estimado"]);

/** ¿La entrada lleva base inmutable COMPLETA? → escalable (reescala por gramos). */
function hasFullBase(entry: EntryDTO): boolean {
  return (
    entry.baseG != null &&
    entry.baseKcal != null &&
    entry.baseProt != null &&
    entry.baseCarb != null &&
    entry.baseFat != null
  );
}

/**
 * B · Duplicar: `EntryDTO` → `EntryInput` idéntico. Copia TODOS los campos, incluida
 * la base inmutable, para que la copia siga siendo escalable — el diferencial frente
 * a «recientes», que entra como `manual` fijo y pierde base/gramos/foto.
 */
export function entryToDuplicateInput(entry: EntryDTO): EntryInput {
  return {
    meal: entry.meal,
    name: entry.name,
    kcal: entry.kcal,
    prot: entry.prot,
    carb: entry.carb,
    fat: entry.fat,
    source: entry.source,
    photoUrl: entry.photoUrl,
    grams: entry.grams,
    baseG: entry.baseG,
    baseKcal: entry.baseKcal,
    baseProt: entry.baseProt,
    baseCarb: entry.baseCarb,
    baseFat: entry.baseFat,
  };
}

/**
 * C · Guardar en «Mis productos»: `EntryDTO` → `ProductInput`.
 * - CON base completa → producto que REESCALA: `baseG/base*` son los valores POR
 *   base (no los escalados de la entrada). Ej.: «avena 150 g / 555 kcal» con base
 *   100 g/370 → producto 100 g/370.
 * - SIN base → producto FIJO (`baseG:null`) con las macros actuales de la entrada.
 * `source`: ia/foto/estimado → estimado; resto → manual. `unit:"g"` (las entradas no
 * guardan unidad; g cubre el 95 %, editable en el catálogo). `grupo:null`,
 * `pinned:false`.
 */
export function entryToProductInput(entry: EntryDTO): ProductInput {
  const scalable = hasFullBase(entry);
  return {
    name: entry.name.trim(),
    baseG: scalable ? entry.baseG : null,
    baseKcal: scalable ? (entry.baseKcal as number) : entry.kcal,
    baseProt: scalable ? (entry.baseProt as number) : entry.prot,
    baseCarb: scalable ? (entry.baseCarb as number) : entry.carb,
    baseFat: scalable ? (entry.baseFat as number) : entry.fat,
    grupo: null,
    source: ESTIMATED_SOURCES.has(entry.source) ? "estimado" : "manual",
    unit: "g",
    pinned: false,
  };
}

/**
 * Dedup por nombre EXACTO (misma regla que `saveConfirmedProduct`): si ya existe un
 * producto con ese nombre (trimmeado), se ACTUALIZA; si no, se CREA. El match es 1:1
 * con `getProductByName` en servidor (igualdad exacta sobre el nombre).
 */
export function resolveProductSave(
  entry: EntryDTO,
  products: ProductDTO[],
): { input: ProductInput; existingId: number | null } {
  const input = entryToProductInput(entry);
  const existing = products.find((p) => p.name === input.name);
  return { input, existingId: existing ? existing.id : null };
}
