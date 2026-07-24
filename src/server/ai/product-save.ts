/*
  F12 · Guardado de producto en «Mis productos» desde el chat, con CONFIRMACIÓN
  determinista en servidor (spec §Flujo 2-3 · Riesgo §1). Es la ÚNICA escritura del
  chat (NO-alcance: nada más). Doctrina de la casa: el SERVIDOR decide y ejecuta; el
  modelo narra. Concretamente, "el modelo no puede auto-concederse el «sí» ni cambiar
  los números después del «sí»":
    · La ficha se extrae del texto del asistente del turno de OFERTA (ya persistido),
      no de argumentos que el modelo rellena en el turno del «sí».
    · La confirmación se detecta de forma determinista sobre el mensaje de Alex.
    · Solo si AMBAS se cumplen se escribe; el fallo de parseo es seguro (no guarda).
  El formato de la línea-ficha lo fija el prompt (chatSystemPrompt): una línea
  `Producto: NOMBRE · BASE UNIDAD · KCAL kcal · PROTP · CARBC · GRASAF`.
*/

export interface ConfirmedProductFicha {
  name: string;
  /** Base de la etiqueta (100 para «por 100 g/ml»); su unidad manda el rótulo. */
  baseG: number;
  unit: "g" | "ml" | "ud";
  kcal: number;
  prot: number;
  carb: number;
  fat: number;
}

function toNumber(raw: string): number {
  return Number.parseFloat(raw.replace(",", "."));
}

// Línea-ficha canónica del turno de oferta. Tolerante a espacios y a coma decimal
// (española); el separador «·» ya es el estándar de la app. El nombre es todo lo que
// va entre «Producto:» y el primer « · », así que admite espacios pero no «·».
const OFFER_LINE =
  /^Producto:\s*(.+?)\s*·\s*(\d+(?:[.,]\d+)?)\s*(g|ml|ud)\s*·\s*(\d+(?:[.,]\d+)?)\s*kcal\s*·\s*(\d+(?:[.,]\d+)?)\s*P\s*·\s*(\d+(?:[.,]\d+)?)\s*C\s*·\s*(\d+(?:[.,]\d+)?)\s*F/im;

/**
 * Extrae la ficha EXACTA que el asistente mostró al ofrecer guardar. `null` si el
 * mensaje no lleva la línea-ficha canónica (fallo seguro: no se guarda nada).
 */
export function parseProductOffer(
  assistantText: string | null | undefined,
): ConfirmedProductFicha | null {
  if (!assistantText) return null;
  const m = OFFER_LINE.exec(assistantText);
  if (!m) return null;
  const [, rawName, rawBase, unit, rawKcal, rawProt, rawCarb, rawFat] = m;
  const name = rawName?.trim();
  if (!name) return null;
  return {
    name,
    baseG: toNumber(rawBase!),
    unit: unit!.toLowerCase() as "g" | "ml" | "ud",
    kcal: toNumber(rawKcal!),
    prot: toNumber(rawProt!),
    carb: toNumber(rawCarb!),
    fat: toNumber(rawFat!),
  };
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // quita tildes: «sí» → «si», «guárdalo» → «guardalo»
    .toLowerCase()
    .replace(/[¿?¡!.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Aplazamiento / negación / petición de cambio → NUNCA se guarda (aunque haya un
// «sí» dentro, p. ej. «sí pero cambia la proteína»).
const NEGATION =
  /\b(no|nunca|espera|todavia|aun|mejor no|dejalo|cancela|para|cambia|corrige|antes|luego|despues)\b/;
// Verbo de guardado explícito en cualquier posición.
const SAVE_VERB = /\b(guarda|guardalo|guardala|guardamelo|apunta|apuntalo|anadelo|anade)\b/;
// Afirmación pura: el mensaje ENTERO es un sí (con rellenos permitidos). Match del
// mensaje completo evita falsos positivos como «si es light».
const AFFIRM_ONLY =
  /^(si|sisi|sip|vale|ok|okay|okey|dale|hazlo|adelante|confirmo|confirmado|correcto|eso es|eso|claro|venga|hecho|perfecto)( (porfa|porfavor|por favor|gracias|va|anda|si|claro|eso))*$/;

/**
 * Confirmación EXPLÍCITA de guardado (spec §Flujo 3). Explícita = un «sí/guárdalo»
 * inequívoco; una negación o petición de cambio nunca confirma.
 */
export function isExplicitSaveConfirmation(text: string): boolean {
  const t = normalize(text);
  if (!t) return false;
  if (NEGATION.test(t)) return false;
  if (SAVE_VERB.test(t)) return true;
  return AFFIRM_ONLY.test(t);
}

/**
 * Combina oferta (turno anterior del asistente) + confirmación (turno actual de
 * Alex). Devuelve la ficha a guardar SOLO si el turno inmediatamente posterior a una
 * oferta la confirma explícitamente; `null` en cualquier otro caso.
 */
export function planConfirmedProductSave(args: {
  lastAssistant: string | null | undefined;
  currentUser: string;
}): ConfirmedProductFicha | null {
  const ficha = parseProductOffer(args.lastAssistant);
  if (!ficha) return null;
  if (!isExplicitSaveConfirmation(args.currentUser)) return null;
  return ficha;
}

export interface SavedProductResult {
  name: string;
  unit: "g" | "ml" | "ud";
  action: "created" | "updated";
}
// La ejecución de la escritura (saveConfirmedProduct) vive en ./product-write.ts:
// toca la BD, y este módulo se mantiene PURO para poder testear el parseo y la
// detección de confirmación sin cargar la capa de datos.
