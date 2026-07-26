import { describe, expect, it } from "vitest";
import {
  deriveFlexibleMealState,
  flexibleMarkers,
  setFlexibleMarker,
} from "./flexible-meals";
import { dayKey } from "./dates";
import { flexibleMealZ } from "./schemas";

describe("estado derivado de comidas flexibles", () => {
  it("una marca vacía es prevista y la primera entrada la convierte en real", () => {
    expect(deriveFlexibleMealState(["cena"], [])).toEqual({
      planned: ["cena"],
      real: [],
    });
    expect(deriveFlexibleMealState(["cena"], [{ meal: "cena" }])).toEqual({
      planned: [],
      real: ["cena"],
    });
  });

  it("borrar la última entrada devuelve real a prevista", () => {
    const real = deriveFlexibleMealState(["merienda"], [
      { meal: "merienda" },
      { meal: "merienda" },
    ]);
    expect(deriveFlexibleMealState(flexibleMarkers(real), [])).toEqual({
      planned: ["merienda"],
      real: [],
    });
  });

  it("ordena y deduplica varios momentos sin convertirlos en días", () => {
    expect(
      deriveFlexibleMealState(["cena", "comida", "cena"], [
        { meal: "cena" },
        { meal: "comida" },
      ]),
    ).toEqual({ planned: [], real: ["comida", "cena"] });
  });

  it("desmarcar no toca las entradas y solo retira el contexto", () => {
    expect(
      setFlexibleMarker(
        { planned: [], real: ["cena"] },
        "cena",
        false,
        [{ meal: "cena" }],
      ),
    ).toEqual({ planned: [], real: [] });
  });

  it("rechaza extra en el boundary compartido", () => {
    expect(flexibleMealZ.safeParse("cena").success).toBe(true);
    expect(flexibleMealZ.safeParse("extra").success).toBe(false);
  });

  it("conserva el día local de Madrid alrededor de medianoche", () => {
    const saturdayNightUtc = new Date("2026-07-25T22:30:00Z");
    expect(dayKey(saturdayNightUtc)).toBe("2026-07-26");
  });
});
