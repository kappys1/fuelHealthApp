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

/*
  ── F25 · El tercer nivel: el grupo ──────────────────────────────────────────
  Una sesión real tiene sección → grupo → líneas, pero el contrato del contenido
  canónico solo tenía dos niveles (bloque y línea), así que el del medio se
  aplanaba: 27 líneas al mismo peso visual. El grupo se DECLARA en el texto con
  una línea que es ELLA ENTERA `**Etiqueta**`; no se adivina con heurísticas
  («línea corta sin cifras») porque destacarían `4 rounds` y no `Adaptado`.

  Exigir la línea completa es el mismo criterio que `isTrainingHeadingLine`: un
  `**5 × 2**` a mitad de frase es énfasis del texto de origen, no estructura.
*/
const groupMarkerRe = () => /^\*\*(.+)\*\*$/;

/**
 * Etiqueta del grupo si la línea es un marcador completo, null si no lo es.
 * Rechaza el marcador anidado (`**a** y **b**`): si hay más de un par de
 * asteriscos la línea es texto con énfasis, no un rótulo.
 */
export function trainingGroupLabel(line: string): string | null {
  const inner = groupMarkerRe().exec(line.trim())?.[1]?.trim();
  if (!inner || inner.includes("**")) return null;
  return inner;
}

/**
 * El rótulo tal como se PINTA: sin los dos puntos finales, que en el texto de
 * origen son puntuación de la frase ("Si aparece dolor >2/10:") y en mayúsculas
 * y con letter-spacing sobran. Es presentación pura y vive aparte a propósito:
 * `trainingGroupLabel` tiene que seguir devolviendo la etiqueta LITERAL, porque
 * de ella depende reconstruir el texto original sin perder un carácter.
 */
export function trainingGroupDisplayLabel(label: string): string {
  return label.replace(/\s*:$/, "");
}

export interface TrainingBlockGroup {
  /** null SOLO en la entradilla del bloque (las líneas previas al 1er marcador). */
  label: string | null;
  text: string;
}

/**
 * Parte el cuerpo de un bloque en grupos. NO decide cortes de bloque: eso sigue
 * siendo de `splitTrainingContent` y su invariante F17 no se toca.
 *
 * Un cuerpo SIN marcadores devuelve un único grupo con el texto EXACTO recibido
 * —ni un carácter normalizado, CRLF incluido— para que las sesiones ya guardadas
 * se pinten byte-idénticas a como se pintan hoy. Solo cuando hay marcadores se
 * recompone por líneas y se recorta el aire de cada grupo.
 */
export function splitTrainingGroups(text: string): TrainingBlockGroup[] {
  if (text.length === 0) return [];
  const rows = text.split(/\r\n|\n|\r/);
  if (!rows.some((row) => trainingGroupLabel(row) !== null)) {
    return [{ label: null, text }];
  }

  /*
    Un rótulo SIN líneas propias no es un rótulo: baja a línea normal. Sale de la
    IA a diario —marca "Power Clean + Power Jerk" y justo debajo "Power Clean"—
    y pintarlo como grupo dejaría una etiqueta flotando sobre una regla, sin
    cuerpo. Bajándolo queda exactamente donde tiene que estar: la entradilla del
    bloque. Se decide mirando la línea siguiente, no rogándoselo al modelo.
  */
  const items = rows.map((row) => {
    const label = trainingGroupLabel(row);
    return label === null ? { label: null, line: row } : { label, line: label };
  });
  for (let i = 0; i < items.length; i++) {
    const item = items[i]!;
    const next = items[i + 1];
    if (item.label !== null && (!next || next.label !== null)) {
      items[i] = { label: null, line: item.label };
    }
  }

  const groups: TrainingBlockGroup[] = [];
  let label: string | null = null;
  let buffer: string[] = [];
  const flush = () => {
    const text = buffer.join("\n").trim();
    // Invariante: ningún grupo sale vacío. La entradilla vacía tampoco existe
    // (un bloque que abre con marcador simplemente no la tiene).
    if (text) groups.push({ label, text });
    buffer = [];
  };
  for (const item of items) {
    if (item.label === null) {
      buffer.push(item.line);
      continue;
    }
    flush();
    label = item.label;
  }
  flush();
  return groups;
}

/**
 * El mismo texto sin marcadores de grupo. Quita SOLO los de línea completa: un
 * `**5 × 2**` a mitad de frase es énfasis que venía en el origen y se respeta
 * (quitar todos los `**` a ciegas modificaría el texto de Alex).
 *
 * Se usa en dos sitios por dos motivos distintos:
 * - `context.ts` (F21): el Chat tiene que recibir EXACTAMENTE el mismo texto que
 *   recibía antes de F25. Los marcadores son pintura de la ficha, no dato.
 * - el formateador: se limpia ANTES de llamar a la IA, así reformatear es
 *   idempotente por construcción (el modelo siempre ve texto plano).
 */
export function stripTrainingGroupMarkers(text: string): string {
  return text
    .split(/(\r\n|\n|\r)/)
    .map((part) => trainingGroupLabel(part) ?? part)
    .join("");
}

/*
  ── El verificador de fidelidad (F25 · lo que hace segura la feature) ─────────
  La mutación PERMITIDA es de un solo tipo: envolver una línea completa en `**`.
  Todo lo demás —una palabra, una cifra, un orden, una línea en blanco entre
  bloques— tiene que sobrevivir intacto. Se comprueba en código, no se confía al
  modelo: si no cuadra, se tira el formateo entero y se guarda el original.

  Lo que la clave tolera (ruido de formato, no información): CRLF vs LF, espacios
  al final de línea, espacios dobles, y líneas en blanco de más. Lo que NO
  tolera: cambiar un carácter, unir o partir líneas, reordenar, y —importante—
  BORRAR una línea en blanco, porque esa línea es lo que separa los bloques
  (contrato F-IA-10) y perderla devolvería la sesión al muro de 27 líneas.
*/
function fidelityKey(text: string): string {
  return stripTrainingGroupMarkers(text)
    .split(/\r\n|\n|\r/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export interface TrainingFormatOutcome {
  /** El texto que hay que guardar: el marcado si es fiel, el original si no. */
  contenido: string;
  /** false = se descartó el formateo y `contenido` es el original intacto. */
  applied: boolean;
  /** Cuántos grupos quedaron marcados (0 = la IA no vio ninguno). */
  groups: number;
  /** Por qué se descartó, para que el aviso al usuario diga algo real. */
  reason: string | null;
}

/**
 * Decide si el texto que devolvió la IA se puede guardar. Pura y testeada: el
 * módulo de servidor solo llama al modelo y delega aquí la decisión.
 */
export function applyTrainingFormat(
  original: string,
  formatted: string,
): TrainingFormatOutcome {
  if (fidelityKey(original) !== fidelityKey(formatted)) {
    return {
      contenido: original,
      applied: false,
      groups: 0,
      reason: "El formateo no coincidía con el texto original y se ha descartado.",
    };
  }
  const groups = formatted
    .split(/\r\n|\n|\r/)
    .filter((line) => trainingGroupLabel(line) !== null).length;
  return { contenido: formatted, applied: true, groups, reason: null };
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
