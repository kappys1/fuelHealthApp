import { type Macros, roundKcal, roundMacroStore, scaleMacros } from "@/lib/macros";
import type { DayDumpItem } from "@/server/ai/schemas";
import type { ProductDTO } from "@/server/db/queries/lookups";

/*
  F18 · Match determinista de «Mis productos» sobre los items del volcado del día.

  Diseño B (spec F18 §Riesgos 2): el MODELO hace el reconocimiento semántico (qué
  producto es, aun descrito de otra forma o dentro de una preparación) y devuelve el
  nombre EXACTO en `item.producto`; el SERVIDOR hace la aritmética (exacta,
  consistente — P2 + lección dato/determinismo): recalcula macros SIEMPRE desde la base
  inmutable del catálogo (nunca sobre valores reescalados).

  El `nombre` del item se CONSERVA tal como lo describió el modelo (la preparación: p.
  ej. «Café con leche de almendras»), NO se sustituye por el del producto (enmienda
  26-jul, DECISIONS #82): renombrar «café con leche de almendras» a solo «Bebida de
  almendras Lidl» borraba que era un café y sería engañoso en un mix real. El nombre
  canónico viaja en `producto` (trazabilidad/eventual chip), no pisa lo que comió Alex.

  Match por nombre EXACTO (trim + case-insensitive). Un nombre inventado o inexacto NO
  empareja → el item se queda tal como lo estimó el modelo (AC5, anti sobre-freno).
*/

const normalize = (s: string): string => s.trim().toLowerCase();

/**
 * Aplica el catálogo a los items del volcado. Para cada item con `producto` que
 * empareje por nombre exacto con un producto real, sustituye nombre→canónico y
 * recalcula macros desde la base guardada. Los demás items quedan intactos.
 * Función pura y testeada; la invoca la ruta `day-dump` tras `runStructured`.
 */
export function applyProductMatches(
  items: readonly DayDumpItem[],
  products: readonly ProductDTO[],
): DayDumpItem[] {
  if (products.length === 0) return items.map((it) => ({ ...it }));
  // Nombre normalizado → producto. Nombres son unique en BD; ante colisión de
  // normalización nos quedamos con el primero (listProducts: fijados y por nombre).
  const byName = new Map<string, ProductDTO>();
  for (const p of products) {
    const key = normalize(p.name);
    if (!byName.has(key)) byName.set(key, p);
  }
  return items.map((it) => {
    if (it.producto == null) return { ...it };
    const p = byName.get(normalize(it.producto));
    if (!p) return { ...it }; // nombre inexacto/inventado → sin match (AC5)
    return matchedItem(it, p);
  });
}

/**
 * Reescribe SOLO los macros/gramos de un item emparejado con los deterministas de su
 * producto. Conserva `it.nombre` (la preparación descrita por el modelo); el nombre
 * canónico va en `producto`.
 */
function matchedItem(it: DayDumpItem, p: ProductDTO): DayDumpItem {
  const base: Macros = {
    kcal: p.baseKcal,
    prot: p.baseProt,
    carb: p.baseCarb,
    fat: p.baseFat,
  };
  // Producto fijo (baseG null): macros base tal cual, sin gramos (sin stepper) — AC4.
  if (p.baseG == null || p.baseG === 0) {
    return {
      ...it,
      producto: p.name,
      gramos: null,
      kcal: roundKcal(base.kcal),
      proteina_g: roundMacroStore(base.prot),
      carbohidratos_g: roundMacroStore(base.carb),
      grasa_g: roundMacroStore(base.fat),
    };
  }
  // baseG != null: reescala con la ración estimada por el modelo; si no la dio,
  // usa la ración base (gramos = baseG → macros = base).
  const gramos = it.gramos ?? p.baseG;
  const m = scaleMacros(base, gramos, p.baseG);
  return {
    ...it,
    producto: p.name,
    gramos,
    kcal: roundKcal(m.kcal),
    proteina_g: roundMacroStore(m.prot),
    carbohidratos_g: roundMacroStore(m.carb),
    grasa_g: roundMacroStore(m.fat),
  };
}
