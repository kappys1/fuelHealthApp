/*
  Derivados del plan (F1.4 / 03-DATOS §3) — función PURA y testeada.

  "Objetivos derivados del plan": para cada comida —
    · Almuerzo: media de sus opciones (se elige 1).
    · Merienda: suma de TODAS sus opciones (es un conjunto).
    · Comida / Cena: agrupar por `grp` y sumar la media de cada grupo (se elige 1
      por grupo).
  Además se acumula kmin/kmax (mín/máx kcal por grupo) para el RANGO del día
  pautado. Total del día = suma de las contribuciones de cada comida.

  AC (F1.4): con el plan semilla da ~1.700-1.800 kcal medio y rango ~1.550-1.950
  (aproximado; el valor exacto del seed queda fijado en el test).
*/
import type { Macros } from "@/lib/macros";
import { sumMacros } from "@/lib/macros";

export interface DerivedInputOption extends Macros {
  meal: string; // almuerzo | comida | merienda | cena | (extra se ignora)
  grp: string;
}

export interface DerivedTargets extends Macros {
  /** kcal mínimas del día pautado (suma de mínimos por grupo/comida). */
  kmin: number;
  /** kcal máximas del día pautado (suma de máximos por grupo/comida). */
  kmax: number;
}

const ZERO: DerivedTargets = { kcal: 0, prot: 0, carb: 0, fat: 0, kmin: 0, kmax: 0 };

function meanMacros(opts: readonly Macros[]): Macros {
  if (opts.length === 0) return { kcal: 0, prot: 0, carb: 0, fat: 0 };
  const s = sumMacros(opts);
  const n = opts.length;
  return { kcal: s.kcal / n, prot: s.prot / n, carb: s.carb / n, fat: s.fat / n };
}

function addTargets(a: DerivedTargets, b: DerivedTargets): DerivedTargets {
  return {
    kcal: a.kcal + b.kcal,
    prot: a.prot + b.prot,
    carb: a.carb + b.carb,
    fat: a.fat + b.fat,
    kmin: a.kmin + b.kmin,
    kmax: a.kmax + b.kmax,
  };
}

/** Contribución de una comida donde se elige 1 opción del conjunto (Almuerzo). */
function chooseOne(opts: readonly DerivedInputOption[]): DerivedTargets {
  if (opts.length === 0) return ZERO;
  const mean = meanMacros(opts);
  const kcals = opts.map((o) => o.kcal);
  return {
    ...mean,
    kmin: Math.min(...kcals),
    kmax: Math.max(...kcals),
  };
}

/** Contribución de una comida-conjunto: se toman TODAS (Merienda). */
function takeAll(opts: readonly DerivedInputOption[]): DerivedTargets {
  if (opts.length === 0) return ZERO;
  const s = sumMacros(opts);
  return { ...s, kmin: s.kcal, kmax: s.kcal };
}

/** Contribución de una comida con 1 elección por grupo (Comida / Cena). */
function chooseOnePerGroup(opts: readonly DerivedInputOption[]): DerivedTargets {
  const byGrp = new Map<string, DerivedInputOption[]>();
  for (const o of opts) {
    const arr = byGrp.get(o.grp);
    if (arr) arr.push(o);
    else byGrp.set(o.grp, [o]);
  }
  let acc = ZERO;
  for (const groupOpts of byGrp.values()) {
    const mean = meanMacros(groupOpts);
    const kcals = groupOpts.map((o) => o.kcal);
    acc = addTargets(acc, {
      ...mean,
      kmin: Math.min(...kcals),
      kmax: Math.max(...kcals),
    });
  }
  return acc;
}

export function derivePlanTargets(
  options: readonly DerivedInputOption[],
): DerivedTargets {
  const byMeal = (meal: string) => options.filter((o) => o.meal === meal);

  const almuerzo = chooseOne(byMeal("almuerzo"));
  const comida = chooseOnePerGroup(byMeal("comida"));
  const merienda = takeAll(byMeal("merienda"));
  const cena = chooseOnePerGroup(byMeal("cena"));
  // "extra" no forma parte del plan pautado → se ignora.

  return [almuerzo, comida, merienda, cena].reduce(addTargets, ZERO);
}
