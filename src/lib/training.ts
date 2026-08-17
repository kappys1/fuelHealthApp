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
  "Rehabilitaci[oó]n",
  "Rehab",
  "Prehab",
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
 * Prioridad de estructura: párrafos de varias líneas > encabezados de sección >
 * párrafos de una línea > líneas sueltas. El corte por línea suelta es el ÚLTIMO
 * recurso y solo entra cuando el texto no tiene ni párrafos ni encabezados: si
 * entrara antes, una sesión importada por IA (que llega con saltos simples) se
 * desmenuzaría en una fila por línea. Un texto plano sin ninguna estructura cae
 * en un único bloque completo.
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

  /*
    Un texto DOBLE-ESPACIADO (línea en blanco entre CADA línea) no tiene párrafos:
    tiene una línea repetida. Copiar de la app del box, de un PDF o de una respuesta
    de chat lo produce a diario. Si mandara el párrafo, cada línea sería su propia
    fila numerada — el destrozo que arregló el quick-fix del 7-ago, entrando por la
    puerta contraria. Cuando TODOS los párrafos son de una línea Y hay encabezados
    de sección, mandan los encabezados.
    Sin encabezados NO se toca nada: tres párrafos de una línea sí son tres bloques
    legítimos ("Bloque de fuerza. / Metcon por tiempo. / Vuelta a la calma."), y
    distinguirlos del doble espaciado sin una señal de estructura sería adivinar.
  */
  const paragraphsAreOneLiners =
    paragraphs.length > 0 &&
    contenido
      .split(/(?:\r\n|\n|\r){2,}/)
      .every((paragraph) => !/\r\n|\n|\r/.test(paragraph.trim()));
  if (paragraphs.length === 0 || paragraphsAreOneLiners) addHeadingCuts(lineHeadingRe());
  const headingsBeatBlankLines = paragraphsAreOneLiners && cuts.size > 0;

  // Las líneas sueltas solo cortan si no hay NINGUNA otra estructura.
  const lineBreaks =
    paragraphs.length === 0 && cuts.size === 0
      ? [...contenido.matchAll(/\r\n|\n|\r/g)]
      : [];
  const breaks =
    paragraphs.length > 0 && !headingsBeatBlankLines ? paragraphs : lineBreaks;
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
 * Texto de un bloque listo para pintar. Es SOLO presentación: no toca el dato
 * guardado, y la invariante F17 (`blocks.join("") === contenido`) sigue viviendo
 * entera en `splitTrainingContent`.
 *
 * Hace dos cosas, las dos por lo mismo — que el aire del documento de origen no
 * se cuele en la ficha: colapsa las líneas en blanco INTERIORES (solo aparecen
 * cuando el texto venía doble-espaciado y mandó el encabezado; un corte por
 * párrafo nunca las deja dentro) y recorta el salto de cierre que ese corte deja
 * pegado al final. Sin esto, ocho líneas ocupan quince renglones.
 */
export function trainingBlockText(block: string): string {
  return block.replace(/(?:[ \t]*(?:\r\n|\n|\r)){2,}/g, "\n").trim();
}

/*
  Una línea que es ELLA ENTERA un encabezado de sección, con ":" opcional (la hoja
  del box escribe "STRENGTH" a pelo) y con el mismo paréntesis aclaratorio que
  admite el corte ("CrossFit (Optional):"). Exigir la línea completa es lo que deja
  fuera "Gymnastics Strength:" y "Accessory → Rehab A": son líneas con contenido
  propio, no rótulos, y destacarlas sería prometer una sección que no empieza ahí.
*/
const headingLineRe = () =>
  new RegExp(`^(?:${SECTION_HEADINGS})(?:\\s*\\([^)\\n]{0,40}\\))?[ \\t]*:?[ \\t]*$`, "i");

/**
 * ¿Esta línea es un rótulo de sección? Se usa SOLO para pintarla distinta en la
 * ficha. No decide cortes: eso es `splitTrainingContent`.
 */
export function isTrainingHeadingLine(line: string): boolean {
  return headingLineRe().test(line.trim());
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
