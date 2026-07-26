import { type Macros, roundKcal, roundMacroStore, scaleMacros } from "@/lib/macros";
import type {
  DayDumpItem,
  PlanOptionAiResult,
} from "@/server/ai/schemas";
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

function productsByName(
  products: readonly ProductDTO[],
): ReadonlyMap<string, ProductDTO> {
  // Nombres son unique en BD; ante colisión de normalización nos quedamos con el
  // primero (listProducts: fijados primero y después por nombre).
  const byName = new Map<string, ProductDTO>();
  for (const p of products) {
    const key = normalize(p.name);
    if (!byName.has(key)) byName.set(key, p);
  }
  return byName;
}

/**
 * Única aritmética producto→macros para F18/F19. Reescala siempre desde la base
 * inmutable guardada y redondea como la persistencia (kcal entera, macros a 1
 * decimal). `grams == null` usa la ración base; producto fijo queda sin escalar.
 */
function productMacros(p: ProductDTO, grams: number | null): Macros {
  const base: Macros = {
    kcal: p.baseKcal,
    prot: p.baseProt,
    carb: p.baseCarb,
    fat: p.baseFat,
  };
  const amount = grams ?? p.baseG ?? 0;
  const scaled = scaleMacros(base, amount, p.baseG);
  return {
    kcal: roundKcal(scaled.kcal),
    prot: roundMacroStore(scaled.prot),
    carb: roundMacroStore(scaled.carb),
    fat: roundMacroStore(scaled.fat),
  };
}

/**
 * Aplica el catálogo a los items del volcado. Para cada item con `producto` que
 * empareje por nombre exacto con un producto real, canoniza `producto` y recalcula
 * macros desde la base guardada. Los demás items quedan intactos.
 * Función pura y testeada; la invoca la ruta `day-dump` tras `runStructured`.
 */
export function applyProductMatches(
  items: readonly DayDumpItem[],
  products: readonly ProductDTO[],
): DayDumpItem[] {
  if (products.length === 0) return items.map((it) => ({ ...it }));
  const byName = productsByName(products);
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
  const macros = productMacros(p, it.gramos);
  // Producto fijo (baseG null): macros base tal cual, sin gramos (sin stepper) — AC4.
  if (p.baseG == null || p.baseG === 0) {
    return {
      ...it,
      producto: p.name,
      gramos: null,
      kcal: macros.kcal,
      proteina_g: macros.prot,
      carbohidratos_g: macros.carb,
      grasa_g: macros.fat,
    };
  }
  // baseG != null: reescala con la ración estimada por el modelo; si no la dio,
  // usa la ración base (gramos = baseG → macros = base).
  const gramos = it.gramos ?? p.baseG;
  return {
    ...it,
    producto: p.name,
    gramos,
    kcal: macros.kcal,
    proteina_g: macros.prot,
    carbohidratos_g: macros.carb,
    grasa_g: macros.fat,
  };
}

/**
 * F19 · Aplica un único producto identificado a la salida de F-IA-3. La opción no
 * trae gramos en el schema: se usan los del body; si faltan, la base del producto.
 * Solo sustituye macros y, cuando existe, el grupo del catálogo. El nombre de la
 * opción vive fuera de esta salida y nunca se toca.
 */
export function applyPlanOptionProductMatch(
  option: PlanOptionAiResult,
  grams: number | null,
  products: readonly ProductDTO[],
): PlanOptionAiResult {
  if (option.producto == null || products.length === 0) return { ...option };
  const product = productsByName(products).get(normalize(option.producto));
  if (!product) return { ...option };

  const macros = productMacros(product, grams);
  return {
    ...option,
    producto: product.name,
    kcal: macros.kcal,
    proteina_g: macros.prot,
    carbohidratos_g: macros.carb,
    grasa_g: macros.fat,
    grupo: product.grupo ?? option.grupo,
  };
}
