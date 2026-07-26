import type { MealKey } from "@/lib/macros";

export const FLEXIBLE_MEAL_KEYS = [
  "almuerzo",
  "comida",
  "merienda",
  "cena",
] as const satisfies readonly MealKey[];

export type FlexibleMealKey = (typeof FLEXIBLE_MEAL_KEYS)[number];

export interface FlexibleMealState {
  planned: FlexibleMealKey[];
  real: FlexibleMealKey[];
}

const FLEXIBLE_ORDER = new Map<FlexibleMealKey, number>(
  FLEXIBLE_MEAL_KEYS.map((meal, index) => [meal, index]),
);

function ordered(meals: Iterable<FlexibleMealKey>): FlexibleMealKey[] {
  return [...new Set(meals)].sort(
    (a, b) => (FLEXIBLE_ORDER.get(a) ?? 0) - (FLEXIBLE_ORDER.get(b) ?? 0),
  );
}

export function flexibleMarkers(state: FlexibleMealState): FlexibleMealKey[] {
  return ordered([...state.planned, ...state.real]);
}

/**
 * `prevista|real` nunca se persiste: se deriva de los marcadores y las entradas
 * del momento. `extra` no puede ser marcador y, por tanto, no participa.
 */
export function deriveFlexibleMealState(
  markers: readonly FlexibleMealKey[],
  entries: readonly { meal: MealKey }[],
): FlexibleMealState {
  const occupied = new Set(entries.map((entry) => entry.meal));
  const planned: FlexibleMealKey[] = [];
  const real: FlexibleMealKey[] = [];

  for (const meal of ordered(markers)) {
    (occupied.has(meal) ? real : planned).push(meal);
  }
  return { planned, real };
}

export function setFlexibleMarker(
  state: FlexibleMealState,
  meal: FlexibleMealKey,
  marked: boolean,
  entries: readonly { meal: MealKey }[],
): FlexibleMealState {
  const markers = new Set(flexibleMarkers(state));
  if (marked) markers.add(meal);
  else markers.delete(meal);
  return deriveFlexibleMealState([...markers], entries);
}
