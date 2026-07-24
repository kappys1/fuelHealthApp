import { getProductByName } from "@/server/db/queries/lookups";
import { createProduct, updateProduct } from "@/server/db/queries/mutations";
import type {
  ConfirmedProductFicha,
  SavedProductResult,
} from "./product-save";

/*
  F12 · Ejecución de la escritura confirmada (impura: toca la BD). Separada de
  product-save.ts —que se mantiene puro y testeable sin la capa de datos—. La
  DECISIÓN de escribir ya la tomó el servidor de forma determinista
  (planConfirmedProductSave); aquí solo se persiste la ficha exacta.
*/

/**
 * Crea o (si el nombre exacto ya existe) actualiza el producto, siempre con
 * `source:'etiqueta'`. Al crear, `pinned:false`. NO toca ninguna otra tabla ni
 * entradas pasadas (AC5): updateProduct solo alimenta futuros añadidos; las macros
 * ya registradas quedaron horneadas por día.
 */
export async function saveConfirmedProduct(
  ficha: ConfirmedProductFicha,
): Promise<SavedProductResult> {
  const name = ficha.name.trim();
  const existing = await getProductByName(name);
  const fields = {
    name,
    baseG: ficha.baseG,
    baseKcal: Math.round(ficha.kcal),
    baseProt: ficha.prot,
    baseCarb: ficha.carb,
    baseFat: ficha.fat,
    unit: ficha.unit,
    source: "etiqueta" as const,
  };
  if (existing) {
    await updateProduct(existing.id, fields);
    return { name, unit: ficha.unit, action: "updated" };
  }
  await createProduct({ ...fields, grupo: null, pinned: false });
  return { name, unit: ficha.unit, action: "created" };
}
