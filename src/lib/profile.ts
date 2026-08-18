import { shiftDayKey } from "@/lib/dates";
import type { TrainingByWeekday } from "@/lib/training-slot";

/*
  Perfil de atleta (doc 10 · Fase A1). Principio 9 (CLAUDE.md): «La IA habla con el
  atleta de hoy» — ningún dato personal/deportivo va hardcodeado en prompts; todo
  sale de este perfil (setting `athleteProfile`, jsonb, sin migración).

  Puro y client-safe: la tarjeta de Ajustes usa los tipos; el servidor construye
  ATHLETE_CONTEXT desde aquí. `edad` se DERIVA de `fechaNacimiento` (nunca se
  guarda) y `diasEntrenoSemana` se DERIVA del mapeo `trainingByWeekday` (una sola
  fuente de verdad) — ver derivaciones abajo.
*/

/** Un objetivo con fecha de inicio. El historial se conserva (no se edita el pasado). */
export interface AthleteObjective {
  /** 'YYYY-MM-DD' — desde cuándo rige este objetivo. */
  desde: string;
  texto: string;
  /** Peso objetivo opcional (kg). */
  pesoObjetivo?: number | null;
}

/*
  F26 Fase 1 · La lesión deja de ser un chip y pasa a ser un EPISODIO fechado con
  capacidad, igual que `objetivos[]`: se cierra poniendo fecha, nunca borrando.
  Dos motivos (spec 26 §Motivación): un chip dice la zona pero no la capacidad —y
  un LLM que supone sobre una lesión sobre-frena—, y quitarlo borra que estuviste
  lesionado.
*/
export interface Lesion {
  /** Estable: la revisión del check-in y el editor se refieren a él. */
  id: string;
  /** "hombro derecho". */
  zona: string;
  /** Diagnóstico o matiz, opcional ("manguito rotador, dx del fisio"). */
  descripcion?: string | null;
  /**
   * TEXTO LIBRE con lo que SÍ y lo que NO puede hacer. Es el campo que importa:
   * el consumidor es un LLM y Alex lo escribe mejor que cualquier taxonomía.
   */
  capacidad: string;
  /**
   * 'YYYY-MM-DD' de inicio, o `null` cuando NO se conoce (chips migrados). No se
   * inventa una fecha: la misma doctrina del episodio en diferido (GLOSARIO).
   */
  desde: string | null;
  /**
   * 'YYYY-MM-DD'. NO es fecha de fin: las lesiones se difuminan, no terminan un
   * día. Al vencer, el check-in pregunta una vez (sigue igual · va mejor · ya está).
   */
  revisarEl: string;
  /** Cerrar = poner fecha. NUNCA borrar. */
  cerradaEl?: string | null;
  /** Casi siempre lo es; declararlo es obligatorio (GLOSARIO, cierre aproximado). */
  cierreAproximado?: boolean;
}

export interface AthleteProfile {
  /** 'YYYY-MM-DD' → la edad se DERIVA, nunca se guarda. */
  fechaNacimiento: string | null;
  alturaCm: number | null;
  sexo?: string | null;
  /** Deporte (texto libre, ej. "CrossFit"). */
  deporte: string;
  /** Nivel (ej. "avanzado, competitivo"). */
  nivel: string;
  /** Programa (ej. "The Progrm 1"). */
  programa: string;
  /** Suplementos que toma hoy (chips en Ajustes). */
  suplementos: string[];
  /** Nota clínica informativa (ej. "le cuesta la grasa abdominal baja"). */
  notaClinica?: string | null;
  /** Episodios de lesión (F26 Fase 1). Historial: las cerradas se conservan. */
  lesiones?: Lesion[];
  /** Historial de objetivos, orden cronológico. Vigente = último por `desde`. */
  objetivos: AthleteObjective[];
}

/*
  Precarga con los valores que HOY estaban hardcodeados (perfil de Alex), para no
  perder nada al migrar el contexto de IA al perfil (doc 10 A1). `fechaNacimiento`
  se fija para derivar 33 años en 2026 (editable en Ajustes; ver DECISIONS).
*/
export const DEFAULT_ATHLETE_PROFILE: AthleteProfile = {
  fechaNacimiento: "1993-01-01",
  alturaCm: 175,
  sexo: null,
  deporte: "CrossFit",
  nivel: "avanzado",
  programa: "The Progrm",
  suplementos: ["creatina", "beta-alanina", "citrulina"],
  notaClinica: "Le cuesta la grasa abdominal baja",
  lesiones: [],
  objetivos: [
    {
      desde: "2026-05-01",
      texto:
        "recomposición corporal: perder grasa manteniendo/ganando músculo, rendimiento en CrossFit, evitar hinchazón/retención; definición para verano",
    },
  ],
};

/** Edad derivada de la fecha de nacimiento (respecto a una clave de día 'YYYY-MM-DD'). */
export function deriveAge(
  fechaNacimiento: string | null | undefined,
  today: string,
): number | null {
  if (!fechaNacimiento) return null;
  const b = fechaNacimiento.split("-").map(Number);
  const t = today.split("-").map(Number);
  const [by, bm = 1, bd = 1] = b;
  const [ty, tm = 1, td = 1] = t;
  if (!by || !ty) return null;
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age >= 0 ? age : null;
}

/** Objetivo vigente = último por `desde` (orden defensivo). */
export function currentObjective(p: AthleteProfile): AthleteObjective | null {
  if (!p.objetivos?.length) return null;
  return (
    [...p.objetivos].sort((a, b) => a.desde.localeCompare(b.desde)).at(-1) ?? null
  );
}

/*
  ── Lesiones (F26 Fase 1) ────────────────────────────────────────────────────
  Funciones PURAS y testeadas (CLAUDE.md: ni una fórmula en componentes). Las
  fechas se mueven SIEMPRE con `shiftDayKey` (Europe/Madrid), nunca con `Date`.
*/

/** Días por defecto hasta la revisión (confirmado por Alex, 18-ago). */
export const LESION_REVIEW_DAYS = 14;

/** Fecha de revisión a partir de una clave de día (desde + 14 por defecto). */
export function lesionReviewDate(
  from: string,
  days: number = LESION_REVIEW_DAYS,
): string {
  return shiftDayKey(from, days);
}

/** Vigente = sin fecha de cierre. */
export function isLesionVigente(l: Lesion): boolean {
  return !l.cerradaEl;
}

/**
 * Vencida = vigente y ya tocaba revisarla. El día `revisarEl` YA cuenta: si se
 * declara hoy con revisión a 14 días, el check-in pregunta el día 14 (AC3), no
 * el 15 — y el chip migrado (revisarEl = hoy) aparece vencido de entrada.
 */
export function isLesionVencida(l: Lesion, today: string): boolean {
  return isLesionVigente(l) && l.revisarEl <= today;
}

/** Lesiones vigentes, las más recientes primero (por `desde`; sin fecha, al final). */
export function lesionesVigentes(p: AthleteProfile): Lesion[] {
  return (p.lesiones ?? [])
    .filter(isLesionVigente)
    .sort((a, b) => (b.desde ?? "").localeCompare(a.desde ?? ""));
}

/** La lesión que toca revisar hoy (la más atrasada), o `null`. */
export function lesionPorRevisar(
  p: AthleteProfile,
  today: string,
): Lesion | null {
  return (
    (p.lesiones ?? [])
      .filter((l) => isLesionVencida(l, today))
      .sort((a, b) => a.revisarEl.localeCompare(b.revisarEl))[0] ?? null
  );
}

/**
 * Cierra un episodio. `cierreAproximado` se marca solo cuando la fecha NO es la
 * de hoy (fecha reconstruida) salvo que quien llama lo fuerce — la revisión del
 * check-in lo fuerza: «ya está» es una respuesta difusa sobre un proceso difuso.
 */
export function closeLesion(
  l: Lesion,
  fecha: string,
  today: string,
  opts?: { aproximado?: boolean },
): Lesion {
  return {
    ...l,
    cerradaEl: fecha,
    cierreAproximado: opts?.aproximado ?? fecha !== today,
  };
}

/** Las tres respuestas de la revisión del check-in (spec 26 §Flujo, paso 3). */
export type LesionReview = "igual" | "mejor" | "cerrada";

/**
 * Aplica la revisión a UNA lesión y devuelve el perfil completo (inmutable). Si
 * el id no existe, el perfil vuelve tal cual: la respuesta llega desde el móvil
 * y el perfil puede haber cambiado por otro lado.
 */
export function applyLesionReview(
  p: AthleteProfile,
  id: string,
  review: LesionReview,
  today: string,
  capacidad?: string,
): AthleteProfile {
  const lesiones = (p.lesiones ?? []).map((l) => {
    if (l.id !== id || !isLesionVigente(l)) return l;
    if (review === "cerrada") return closeLesion(l, today, today, { aproximado: true });
    const nueva = capacidad?.trim();
    return {
      ...l,
      capacidad: review === "mejor" && nueva ? nueva : l.capacidad,
      revisarEl: lesionReviewDate(today),
    };
  });
  return { ...p, lesiones };
}

function asDayKey(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

/**
 * Normaliza el valor guardado a episodios. Convierte los CHIPS viejos
 * (`string[]`) SIN PÉRDIDA: el texto del chip pasa a `zona`, sin capacidad, sin
 * fecha de inicio (no se conoce) y con revisión para hoy → aparece vencida y la
 * primera revisión pide la capacidad. Ids deterministas (`legacy-N`) para que la
 * revisión funcione aunque el perfil normalizado aún no se haya guardado.
 */
export function normalizeLesiones(value: unknown, today: string): Lesion[] {
  if (!Array.isArray(value)) return [];
  const out: Lesion[] = [];
  value.forEach((raw, i) => {
    if (typeof raw === "string") {
      const zona = raw.trim();
      if (zona) {
        out.push({
          id: `legacy-${i}`,
          zona,
          descripcion: null,
          capacidad: "",
          desde: null,
          revisarEl: today,
          cerradaEl: null,
          cierreAproximado: false,
        });
      }
      return;
    }
    if (typeof raw !== "object" || raw === null) return;
    const l = raw as Record<string, unknown>;
    const zona = typeof l.zona === "string" ? l.zona.trim() : "";
    if (!zona) return;
    const desde = asDayKey(l.desde);
    out.push({
      id: typeof l.id === "string" && l.id ? l.id : `legacy-${i}`,
      zona,
      descripcion: typeof l.descripcion === "string" ? l.descripcion : null,
      capacidad: typeof l.capacidad === "string" ? l.capacidad : "",
      desde,
      revisarEl:
        asDayKey(l.revisarEl) ?? (desde ? lesionReviewDate(desde) : today),
      cerradaEl: asDayKey(l.cerradaEl),
      cierreAproximado: l.cierreAproximado === true,
    });
  });
  return out;
}

/** Días de entreno/semana DERIVADOS del mapeo (nº de días ≠ Descanso/vacío). */
export function trainingDaysPerWeek(map: TrainingByWeekday): number {
  return ["1", "2", "3", "4", "5", "6", "7"].filter(
    (day) => map[day] !== "descanso",
  ).length;
}
