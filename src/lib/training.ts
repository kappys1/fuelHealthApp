import { SESSIONS } from "@/lib/macros";
import { isoWeekday, shiftDayKey } from "@/lib/dates";

/*
  Helpers puros de entrenamiento (doc 10 Fase B). Client-safe: NO importa el schema
  de servidor (drizzle). Los valores de `TRAINING_TIPOS` deben coincidir 1:1 con
  `trainingTipoEnum` en `src/server/db/schema.ts` (se mantienen sincronizados a mano).
*/

export const TRAINING_TIPOS = [
  "fuerza",
  "halterofilia",
  "gimnasticos",
  "metabolico",
  "aerobico",
  "mixto",
  "descanso",
  "otro",
] as const;
export type TrainingTipo = (typeof TRAINING_TIPOS)[number];

export const TRAINING_TIPO_LABELS: Record<TrainingTipo, string> = {
  fuerza: "Fuerza",
  halterofilia: "Halterofilia",
  gimnasticos: "Gimnásticos",
  metabolico: "Metabólico",
  aerobico: "Aeróbico",
  mixto: "Mixto",
  descanso: "Descanso",
  otro: "Otro",
};

/*
  Encabezados de sección de una programación, en el orden de alternancia que exige
  el regex (la variante larga ANTES que la corta: "Weightlifting/Strength" tiene que
  ganarle a "Strength"). Se reconocen en español y en inglés porque conviven las dos
  fuentes reales: la hoja del box y The Progrm.
*/
const SECTION_HEADINGS = [
  "Fuerza\\s*/\\s*Halterofilia",
  "Halterofilia",
  "Fuerza",
  "Acondicionamiento",
  "Calentamiento",
  "Enfriamiento",
  "Vuelta a la calma",
  "Movilidad",
  "T[eé]cnica",
  "Gimn[aá]sticos",
  "Accesorios?",
  "Plyometrics",
  "Weightlifting\\s*/\\s*Strength",
  "Weightlifting",
  "Strength",
  "Conditioning",
  "Gymnastics",
  "Accessor(?:y|ies)",
  "CrossFit",
  "Metcon",
  "WOD",
].join("|");

/*
  Dos formas de encabezado, deliberadamente distintas:
  - LEGACY: en cualquier posición de la línea, pero SIEMPRE con ":" y solo con el
    vocabulario original. Es el que parte "…squat clean. CrossFit: 5 rondas" en una
    programación escrita a línea corrida.
  - LINE: a principio de línea, con el vocabulario ampliado y con ":" opcional
    (la hoja del box escribe "STRENGTH" / "WOD" a pelo). Solo entra cuando el texto
    NO trae párrafos: donde hay línea en blanco manda la línea en blanco, y así una
    programación de PDF que ya se agrupaba bien no cambia ni un bloque. Exigir el
    inicio de línea evita además cortar "Gymnastics Strength:" dentro de un bloque.
*/
const legacyHeadingRe = () =>
  /\b(?:Fuerza\s*\/\s*Halterofilia|Fuerza|Halterofilia|CrossFit|Accesorios?):\s*/gi;
const lineHeadingRe = () =>
  new RegExp(
    `(?<=^|\\r\\n|\\n|\\r)(?:${SECTION_HEADINGS})(?:\\s*\\([^)\\n]{0,40}\\))?[ \\t]*(?::|(?=\\r?\\n|$))`,
    "gi",
  );

/**
 * Divide el contenido canónico en bloques de presentación sin normalizar ni
 * descartar un solo carácter (F17). Cada bloque conserva sus propios saltos de
 * línea, de modo que `blocks.join("") === contenido` siempre.
 *
 * Prioridad de estructura: párrafos > encabezados de sección > líneas sueltas.
 * El corte por línea suelta es el ÚLTIMO recurso y solo entra cuando el texto no
 * tiene ni párrafos ni encabezados: si entrara antes, una sesión importada por IA
 * (que llega con saltos simples) se desmenuzaría en una fila por línea. Un texto
 * plano sin ninguna estructura cae en un único bloque completo.
 *
 * Al cortar por línea NUNCA se parte una frase envuelta: si la línea siguiente
 * arranca en minúscula es la continuación visual de la anterior (el texto copiado
 * de un PDF trae los saltos del ajuste de página) y se queda en el mismo bloque.
 */
export function splitTrainingContent(contenido: string): string[] {
  if (contenido.length === 0) return [];

  const cuts = new Set<number>();
  const addHeadingCuts = (re: RegExp) => {
    for (const match of contenido.matchAll(re)) {
      if (contenido.slice(0, match.index).trim()) cuts.add(match.index!);
    }
  };
  addHeadingCuts(legacyHeadingRe());

  const paragraphs = [...contenido.matchAll(/(?:\r\n|\n|\r){2,}/g)];
  if (paragraphs.length === 0) addHeadingCuts(lineHeadingRe());

  // Las líneas sueltas solo cortan si no hay NINGUNA otra estructura.
  const lineBreaks =
    paragraphs.length === 0 && cuts.size === 0
      ? [...contenido.matchAll(/\r\n|\n|\r/g)]
      : [];
  const breaks = paragraphs.length > 0 ? paragraphs : lineBreaks;
  const isWrappedContinuation = (afterBreak: number) => {
    const next = contenido.slice(afterBreak).match(/^[^\r\n]*/)?.[0].trimStart() ?? "";
    const first = next.charAt(0);
    return first !== "" && first !== first.toUpperCase();
  };

  for (const match of breaks) {
    const afterBreak = (match.index ?? 0) + match[0].length;
    if (
      contenido.slice(0, match.index).trim() &&
      afterBreak < contenido.length &&
      !(breaks === lineBreaks && isWrappedContinuation(afterBreak))
    ) {
      cuts.add(afterBreak);
    }
  }

  const indexes = [...cuts].sort((a, b) => a - b);
  if (indexes.length === 0) return [contenido];
  const blocks: string[] = [];
  let start = 0;
  for (const end of indexes) {
    if (end > start) blocks.push(contenido.slice(start, end));
    start = end;
  }
  if (start < contenido.length) blocks.push(contenido.slice(start));
  return blocks;
}

/**
 * kcal de sesión para `days.sessionKcal` a partir del rango estimado (F-IA-5):
 * media redondeada; si falta un extremo usa el otro; null si no hay datos.
 */
export function sessionKcal(
  min: number | null | undefined,
  max: number | null | undefined,
): number | null {
  const lo = min ?? null;
  const hi = max ?? null;
  if (lo == null && hi == null) return null;
  if (lo == null) return Math.round(hi as number);
  if (hi == null) return Math.round(lo);
  return Math.round((lo + hi) / 2);
}

/**
 * Periodo del plan (`valid_from`/`valid_to`) a partir de las fechas asignadas a las
 * sesiones. Las claves 'YYYY-MM-DD' ordenan lexicográficamente. null si no hay fechas.
 */
export function planSpanFromAssignments(
  dates: readonly string[],
): { validFrom: string; validTo: string } | null {
  const valid = dates
    .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .slice()
    .sort();
  const first = valid[0];
  const last = valid[valid.length - 1];
  if (!first || !last) return null;
  return { validFrom: first, validTo: last };
}

/** Semana canónica lunes-domingo que contiene `date`. */
export function trainingWeekSpan(date: string): {
  validFrom: string;
  validTo: string;
} {
  const validFrom = shiftDayKey(date, -(isoWeekday(date) - 1));
  return { validFrom, validTo: shiftDayKey(validFrom, 6) };
}

/**
 * Estado derivado del navegador semanal de Plan. La semana solicitada se conserva
 * también si es futura; `today` solo decide si el modo es histórico/de lectura.
 */
export function trainingWeekNavigation(
  requestedDate: string,
  today: string,
): {
  selectedWeek: string;
  currentWeek: string;
  isPast: boolean;
} {
  const selectedWeek = trainingWeekSpan(requestedDate).validFrom;
  const currentWeek = trainingWeekSpan(today).validFrom;
  return {
    selectedWeek,
    currentWeek,
    isPast: selectedWeek < currentWeek,
  };
}

/**
 * Opciones del dropdown de sesión (doc 10 B3):
 * - CON semana importada → sus sesiones reales (por nombre) + Competición + Descanso.
 *   Las genéricas T1–T6 se ocultan (eran ruido cuando ya hay plan).
 * - SIN semana → la lista genérica SESSIONS (T1–T6 + Competición + Descanso).
 * Deduplica conservando el orden.
 */
export function orderedSessionOptions(
  planSessionNames: readonly string[],
): string[] {
  if (planSessionNames.length === 0) return [...SESSIONS];
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (v: string) => {
    const t = v.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };
  for (const n of planSessionNames) add(n);
  add("Competición");
  add("Descanso");
  return out;
}

/**
 * Patch de día al elegir una sesión en el dropdown (doc 10 B3). Si el label es una
 * sesión real del plan, ancla `sessionRef` + su kcal estimada; si es genérica/
 * Competición/Descanso, `sessionRef` = null (y limpia la kcal estimada del plan).
 */
export function sessionPatchFor(
  label: string,
  sessions: readonly {
    id: number;
    nombre: string;
    kcalMin: number | null;
    kcalMax: number | null;
  }[],
): { sessionLabel: string; sessionRef: number | null; sessionKcal: number | null } {
  const s = sessions.find((x) => x.nombre === label);
  if (s) {
    return {
      sessionLabel: s.nombre,
      sessionRef: s.id,
      sessionKcal: sessionKcal(s.kcalMin, s.kcalMax),
    };
  }
  return { sessionLabel: label, sessionRef: null, sessionKcal: null };
}
