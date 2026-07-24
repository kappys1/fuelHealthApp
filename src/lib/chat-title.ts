/*
  Títulos de hilo de chat (F-IA-8 / F12). Funciones PURAS (sin BD ni IA) para poder
  testearlas sin cargar la capa de datos:
  - threadTitleFrom: recorte determinista de la primera pregunta. Es el título inicial
    (createThread) y el FALLBACK último si el título IA falla o queda vacío.
  - sanitizeThreadTitle: saneado de la salida del modelo (F12) a 4-6 palabras limpias.
*/

/**
 * Título del hilo: resumen determinista de la primera pregunta. Un título generado
 * por IA queda como mejora menor y nunca bloquea la lista ni añade coste al abrirla.
 */
export function threadTitleFrom(message: string): string {
  const clean = message
    .trim()
    .replace(/^[¿¡]+/, "")
    .replace(/\s+/g, " ");
  const sentence = clean.split(/[.!?\n]/, 1)[0]?.trim() ?? "";
  const words = sentence.split(/\s+/).slice(0, 8).join(" ");
  return words.length > 58 ? `${words.slice(0, 55).trimEnd()}…` : words || "Nuevo hilo";
}

/**
 * Sanea la salida del título IA (F12) a 4-6 palabras limpias: primera línea no vacía,
 * sin comillas ni puntuación/markdown envolvente, colapsando espacios y con tope de
 * longitud. Devuelve "" si no queda nada usable → el caller cae a threadTitleFrom.
 */
export function sanitizeThreadTitle(raw: string): string {
  const firstLine =
    raw
      .split("\n")
      .map((s) => s.trim())
      .find(Boolean) ?? "";
  const unquoted = firstLine
    .replace(/^["'«»“”*_\-\s]+/, "")
    .replace(/["'«»“”.*_\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!unquoted) return "";
  const words = unquoted.split(" ").filter(Boolean).slice(0, 6).join(" ");
  return words.length > 58 ? `${words.slice(0, 55).trimEnd()}…` : words;
}
