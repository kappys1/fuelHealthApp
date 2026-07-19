/*
  Contribución calórica de los macros (Restyle v2 · F2) — función PURA.

  Reparte las kcal de un día entre proteína, hidratos y grasa por Atwater
  (P×4 · C×4 · F×9), para el gráfico de ingesta apilada de Progreso. Es una
  derivación exacta de datos reales (los gramos registrados), no una estimación:
  la barra apilada muestra DE DÓNDE vienen las calorías del día. NO sustituye al
  total de kcal registrado (que puede diferir por redondeos): es una vista de
  composición, coherente con «las macros sin decimales en UI».
*/

export const KCAL_PER_G = { prot: 4, carb: 4, fat: 9 } as const;

export interface CaloricContribution {
  protKcal: number;
  carbKcal: number;
  fatKcal: number;
  /** Suma de las tres contribuciones (kcal por Atwater). */
  totalKcal: number;
}

export function caloricContribution(
  prot: number,
  carb: number,
  fat: number,
): CaloricContribution {
  const protKcal = prot * KCAL_PER_G.prot;
  const carbKcal = carb * KCAL_PER_G.carb;
  const fatKcal = fat * KCAL_PER_G.fat;
  return { protKcal, carbKcal, fatKcal, totalKcal: protKcal + carbKcal + fatKcal };
}
