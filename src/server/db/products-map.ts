import { roundKcal, roundMacroStore } from "@/lib/macros";
import type * as schema from "./schema";

/*
  Lógica PURA de products (F07), sin dependencia del cliente de BD → testeable sin
  conexión (mismo patrón que backup-map.ts). Cubre:
  - favoritesToProducts: migración favorites → products (0 pérdidas, principio 7),
    con dedupe de colisiones de nombre (los favoritos eran únicos por (meal,name),
    así que el mismo nombre puede estar en 2 comidas).
  - productImportRow: mapeo de una fila de products del export al insert del restore
    (round-trip, AC4).
*/

type ProductInsert = typeof schema.products.$inferInsert;

/** Fila de favorites tal como llega del export/DB o de un seed (id opcional). */
export interface FavRow {
  id?: number;
  meal?: string;
  name: string;
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

export interface FavoritesToProducts {
  products: ProductInsert[];
  /** Colisiones de nombre descartadas (se conservó la más reciente). Para logear. */
  discarded: { name: string; keptId: number | null; droppedId: number | null }[];
}

/**
 * Migra los favoritos a productos (F07 §Datos): cada favorito → producto con
 * `source:'legacy'`, `baseG:null` (fijo, foto congelada de una estimación),
 * `pinned:true` (siguen saliendo como chips) y `grupo:null`.
 *
 * Colisión de nombre (mismo nombre en 2 comidas): se **dedupe por name** conservando
 * el más reciente (mayor `id`; si no hay id, el último del array), anotando los
 * descartes en `discarded` — nunca se pierde información silenciosamente (principio 7).
 * Función pura: la usan el script de migración, seed y migrate:poc.
 */
export function favoritesToProducts(favs: FavRow[]): FavoritesToProducts {
  // Recencia: mayor id; sin id, el orden del array (índice mayor = más reciente).
  const rank = (f: FavRow, i: number) => f.id ?? i;
  const best = new Map<string, { fav: FavRow; r: number }>();
  const discarded: FavoritesToProducts["discarded"] = [];

  favs.forEach((fav, i) => {
    const r = rank(fav, i);
    const prev = best.get(fav.name);
    if (!prev) {
      best.set(fav.name, { fav, r });
      return;
    }
    // Colisión: conservar el de mayor rango; anotar el descartado.
    if (r >= prev.r) {
      discarded.push({
        name: fav.name,
        keptId: fav.id ?? null,
        droppedId: prev.fav.id ?? null,
      });
      best.set(fav.name, { fav, r });
    } else {
      discarded.push({
        name: fav.name,
        keptId: prev.fav.id ?? null,
        droppedId: fav.id ?? null,
      });
    }
  });

  const products: ProductInsert[] = [...best.values()].map(({ fav }) => ({
    name: fav.name,
    baseG: null,
    baseKcal: roundKcal(fav.kcal),
    baseProt: roundMacroStore(fav.prot),
    baseCarb: roundMacroStore(fav.carb),
    baseFat: roundMacroStore(fav.fat),
    grupo: null,
    source: "legacy",
    unit: "g", // los favoritos legacy son fijos por unidad, rótulo por defecto
    pinned: true,
  }));

  return { products, discarded };
}

const n = (v: unknown): number | null =>
  v == null || v === "" ? null : Number(v);
const dt = (v: unknown): Date =>
  v instanceof Date ? new Date(v.getTime()) : v ? new Date(String(v)) : new Date();

/**
 * Mapea una fila de products del archivo de export a la fila de inserción del
 * restore (AC4). Se dropea el `id` (identity reasigna); `name` es unique. Los campos
 * base obligatorios caen a 0 si faltasen (archivo corrupto) para no romper el insert.
 */
export function productImportRow(
  r: Record<string, unknown>,
): typeof schema.products.$inferInsert {
  return {
    name: String(r.name ?? ""),
    baseG: n(r.baseG),
    baseKcal: Number(r.baseKcal ?? 0),
    baseProt: Number(r.baseProt ?? 0),
    baseCarb: Number(r.baseCarb ?? 0),
    baseFat: Number(r.baseFat ?? 0),
    grupo: (r.grupo ?? null) as (typeof schema.grpEnum.enumValues)[number] | null,
    source: (r.source ??
      "legacy") as (typeof schema.productSourceEnum.enumValues)[number],
    // unit (F10): default 'g' si el export es anterior a F10 (round-trip AC7).
    unit: (r.unit ?? "g") as (typeof schema.productUnitEnum.enumValues)[number],
    pinned: Boolean(r.pinned ?? false),
    createdAt: dt(r.createdAt),
    updatedAt: dt(r.updatedAt),
  };
}
