import type { SessionByWeekday } from "@/lib/macros";

/*
  Perfil de atleta (doc 10 · Fase A1). Principio 9 (CLAUDE.md): «La IA habla con el
  atleta de hoy» — ningún dato personal/deportivo va hardcodeado en prompts; todo
  sale de este perfil (setting `athleteProfile`, jsonb, sin migración).

  Puro y client-safe: la tarjeta de Ajustes usa los tipos; el servidor construye
  ATHLETE_CONTEXT desde aquí. `edad` se DERIVA de `fechaNacimiento` (nunca se
  guarda) y `diasEntrenoSemana` se DERIVA del mapeo `sessionByWeekday` (una sola
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
  /** Franja de entreno (ej. "19:30-21:30"). */
  franjaEntreno: string;
  /** Suplementos que toma hoy (chips en Ajustes). */
  suplementos: string[];
  /** Nota clínica informativa (ej. "le cuesta la grasa abdominal baja"). */
  notaClinica?: string | null;
  /** Lesiones informativas para el coach. */
  lesiones?: string[];
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
  franjaEntreno: "19:30-21:30",
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

/** Días de entreno/semana DERIVADOS del mapeo (nº de días ≠ Descanso/vacío). */
export function trainingDaysPerWeek(map: SessionByWeekday): number {
  return ["1", "2", "3", "4", "5", "6", "7"].filter((d) => {
    const v = (map[d] ?? "").trim().toLowerCase();
    return v !== "" && v !== "descanso";
  }).length;
}
