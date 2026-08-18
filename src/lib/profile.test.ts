import { describe, expect, it } from "vitest";
import { DEFAULT_TRAINING_BY_WEEKDAY } from "@/lib/training-slot";
import {
  applyLesionReview,
  type AthleteProfile,
  closeLesion,
  currentObjective,
  DEFAULT_ATHLETE_PROFILE,
  deriveAge,
  isLesionVencida,
  type Lesion,
  lesionesVigentes,
  lesionPorRevisar,
  lesionReviewDate,
  normalizeLesiones,
  trainingDaysPerWeek,
} from "./profile";

describe("perfil de atleta — derivaciones (doc 10 A1)", () => {
  it("deriva la edad de la fecha de nacimiento (cumpleaños ya pasado)", () => {
    expect(deriveAge("1993-01-01", "2026-07-12")).toBe(33);
  });

  it("resta un año si el cumpleaños aún no ha llegado este año", () => {
    expect(deriveAge("1993-12-31", "2026-07-12")).toBe(32);
  });

  it("edad null si falta la fecha de nacimiento", () => {
    expect(deriveAge(null, "2026-07-12")).toBeNull();
  });

  it("objetivo vigente = último por `desde` (no el orden del array)", () => {
    const p: AthleteProfile = {
      ...DEFAULT_ATHLETE_PROFILE,
      objetivos: [
        { desde: "2026-01-01", texto: "volumen" },
        { desde: "2026-06-01", texto: "definición" },
        { desde: "2026-03-01", texto: "mantenimiento" },
      ],
    };
    expect(currentObjective(p)?.texto).toBe("definición");
  });

  it("diasEntrenoSemana se deriva del mapeo (nº de días ≠ Descanso)", () => {
    // Default: L-S entrenan, D descanso → 6.
    expect(trainingDaysPerWeek(DEFAULT_TRAINING_BY_WEEKDAY)).toBe(6);
    expect(
      trainingDaysPerWeek({
        ...DEFAULT_TRAINING_BY_WEEKDAY,
        "2": "descanso",
        "3": "descanso",
      }),
    ).toBe(4);
  });
});

const TODAY = "2026-08-18";

/** El caso real que originó F26: hombro derecho tocado desde el 28-jul. */
const HOMBRO: Lesion = {
  id: "l1",
  zona: "hombro derecho",
  capacidad:
    "NO: nada por encima de cabeza, press, kipping, snatch. SÍ: tirón horizontal, remo, peso muerto, pierna, cardio sin brazos.",
  desde: "2026-07-28",
  revisarEl: "2026-08-11",
};

const profileWith = (lesiones: Lesion[]): AthleteProfile => ({
  ...DEFAULT_ATHLETE_PROFILE,
  lesiones,
});

describe("F26 Fase 1 · la lesión como episodio", () => {
  it("la revisión son 14 días desde la fecha dada, en Europe/Madrid", () => {
    expect(lesionReviewDate("2026-07-28")).toBe("2026-08-11");
    // Cruzando el cambio de hora (25-oct): la clave de día no se desplaza.
    expect(lesionReviewDate("2026-10-20")).toBe("2026-11-03");
  });

  it("vencida el mismo día de la revisión, no al siguiente (AC3)", () => {
    expect(isLesionVencida(HOMBRO, "2026-08-10")).toBe(false);
    expect(isLesionVencida(HOMBRO, "2026-08-11")).toBe(true);
    expect(isLesionVencida(HOMBRO, TODAY)).toBe(true);
  });

  it("una lesión cerrada no está vigente ni vuelve a vencer", () => {
    const cerrada = { ...HOMBRO, cerradaEl: "2026-08-15" };
    expect(isLesionVencida(cerrada, TODAY)).toBe(false);
    expect(lesionesVigentes(profileWith([cerrada]))).toEqual([]);
    expect(lesionPorRevisar(profileWith([cerrada]), TODAY)).toBeNull();
  });

  it("pregunta por la más atrasada cuando hay varias vencidas", () => {
    const rodilla: Lesion = {
      id: "l2",
      zona: "rodilla",
      capacidad: "",
      desde: "2026-08-01",
      revisarEl: "2026-08-05",
    };
    expect(lesionPorRevisar(profileWith([HOMBRO, rodilla]), TODAY)?.id).toBe("l2");
  });

  it("sin lesiones vencidas no hay nada que preguntar (los demás días, AC3)", () => {
    const fresca = { ...HOMBRO, revisarEl: "2026-09-01" };
    expect(lesionPorRevisar(profileWith([fresca]), TODAY)).toBeNull();
  });
});

describe("F26 Fase 1 · revisión del check-in", () => {
  it("«sigue igual» aplaza 14 días desde HOY y no toca la capacidad", () => {
    const p = applyLesionReview(profileWith([HOMBRO]), "l1", "igual", TODAY);
    expect(p.lesiones![0]!.revisarEl).toBe("2026-09-01");
    expect(p.lesiones![0]!.capacidad).toBe(HOMBRO.capacidad);
    expect(p.lesiones![0]!.cerradaEl).toBeUndefined();
  });

  it("«va mejor» reescribe la capacidad y aplaza 14 días", () => {
    const p = applyLesionReview(
      profileWith([HOMBRO]),
      "l1",
      "mejor",
      TODAY,
      "SÍ press ligero por encima de cabeza; NO kipping.",
    );
    expect(p.lesiones![0]!.capacidad).toContain("press ligero");
    expect(p.lesiones![0]!.revisarEl).toBe("2026-09-01");
  });

  it("«va mejor» sin texto conserva la capacidad anterior (no la vacía)", () => {
    const p = applyLesionReview(profileWith([HOMBRO]), "l1", "mejor", TODAY, "  ");
    expect(p.lesiones![0]!.capacidad).toBe(HOMBRO.capacidad);
  });

  it("«ya está» cierra con hoy, MARCADO APROXIMADO, sin borrar nada (AC2, AC5)", () => {
    const p = applyLesionReview(profileWith([HOMBRO]), "l1", "cerrada", TODAY);
    expect(p.lesiones).toHaveLength(1);
    expect(p.lesiones![0]!.cerradaEl).toBe(TODAY);
    expect(p.lesiones![0]!.cierreAproximado).toBe(true);
    expect(p.lesiones![0]!.zona).toBe("hombro derecho");
    expect(p.lesiones![0]!.desde).toBe("2026-07-28");
    expect(p.lesiones![0]!.capacidad).toBe(HOMBRO.capacidad);
  });

  it("un id desconocido deja el perfil intacto", () => {
    const base = profileWith([HOMBRO]);
    expect(applyLesionReview(base, "otro", "cerrada", TODAY)).toEqual(base);
  });

  it("el cierre manual solo es aproximado si la fecha no es la de hoy (AC5)", () => {
    expect(closeLesion(HOMBRO, TODAY, TODAY).cierreAproximado).toBe(false);
    expect(closeLesion(HOMBRO, "2026-08-10", TODAY).cierreAproximado).toBe(true);
  });
});

describe("F26 Fase 1 · normalizador de chips viejos (AC4 · 0 pérdidas)", () => {
  it("cada chip sobrevive como episodio vencido que pedirá su capacidad", () => {
    const chips = ["hombro derecho", "fascitis plantar"];
    const out = normalizeLesiones(chips, TODAY);

    expect(out.map((l) => l.zona)).toEqual(chips); // 0 pérdidas
    for (const l of out) {
      expect(l.capacidad).toBe("");
      expect(l.desde).toBeNull(); // no se inventa la fecha de inicio
      expect(l.revisarEl).toBe(TODAY);
      expect(isLesionVencida(l, TODAY)).toBe(true);
    }
    expect(new Set(out.map((l) => l.id)).size).toBe(2);
  });

  it("los ids de los chips son DETERMINISTAS (la revisión los encuentra)", () => {
    const chips = ["hombro derecho", "fascitis plantar"];
    expect(normalizeLesiones(chips, TODAY)).toEqual(
      normalizeLesiones(chips, TODAY),
    );
    // La revisión funciona sobre el perfil normalizado aún sin haberlo guardado.
    const p = profileWith(normalizeLesiones(chips, TODAY));
    const revisar = lesionPorRevisar(p, TODAY)!;
    const after = applyLesionReview(p, revisar.id, "cerrada", TODAY);
    expect(after.lesiones!.filter((l) => l.cerradaEl)).toHaveLength(1);
  });

  it("es idempotente sobre episodios ya normalizados", () => {
    const once = normalizeLesiones([HOMBRO], TODAY);
    expect(normalizeLesiones(once, TODAY)).toEqual(once);
    expect(once[0]).toMatchObject({
      id: "l1",
      zona: "hombro derecho",
      desde: "2026-07-28",
      revisarEl: "2026-08-11",
    });
  });

  it("deriva la revisión de `desde` si falta, y tolera basura sin romper", () => {
    const out = normalizeLesiones(
      [
        { zona: "codo", capacidad: "sin dominadas", desde: "2026-08-04" },
        { zona: "   " },
        null,
        42,
        "",
      ],
      TODAY,
    );
    expect(out).toHaveLength(1);
    expect(out[0]!.revisarEl).toBe("2026-08-18");
  });

  it("un valor ausente o que no es lista da lista vacía", () => {
    expect(normalizeLesiones(undefined, TODAY)).toEqual([]);
    expect(normalizeLesiones("hombro", TODAY)).toEqual([]);
  });
});
