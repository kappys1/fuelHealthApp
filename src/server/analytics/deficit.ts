/*
  Déficit / TDEE reales DESDE EL PESO (03-DATOS §3 / F6.2 / principio 1) — PURO.

  Requiere ≥8 pesajes elegibles repartidos en ≥7 días. Si no, estado "no enough"
  (la UI pide pesarse a diario en ayunas).

    kgSemana     = (ma7(último) − ma7(primero)) / díasEntreEllos × 7
    deficitDía   = round(−kgSemana × 7700 / 7)     // 7.700 kcal ≈ 1 kg de grasa
    ingestaMedia = media(kcal de días con registro y phase == Normal)
    TDEE         = ingestaMedia + deficitDía

  La cifra que MANDA es el déficit desde el peso; las kcal del reloj y las
  sesiones son solo contexto.

  F22 · dos correcciones de método (misma fórmula, mismo doc 03 §3):

  1. VENTANA EXPLÍCITA. La función recibe SIEMPRE el histórico completo y una
     ventana `[from, to]`. Antes cada superficie recortaba por su cuenta: la
     pantalla pasaba el rango del selector (90 d por defecto) y Chat/Coach/Visita
     el histórico entero, así que "la cifra que manda" tenía dos valores distintos
     el mismo día. Ahora la ventana canónica (30 d) es la misma en las cuatro.

  2. BORDE IZQUIERDO DE LA ma7. `ma7At` promedia [d−6, d] DENTRO de la serie que
     recibe: si la serie empezaba en el borde de la ventana, `ma7(primero)` era un
     peso crudo de una sola muestra frente a un `ma7(último)` suavizado, y un
     extremo desviado 0,5 kg movía el TDEE ~7 %. Por eso la ma7 se calcula sobre la
     serie COMPLETA y solo la elección de primero/último se limita a la ventana
     (mismo patrón que ya usaba el gráfico).
*/
import { daysBetween, shiftDayKey } from "@/lib/dates";
import { eligibleWeightSeries, ma7At } from "./ma7";
import type { AnalyticsRecord } from "./types";

/** 7.700 kcal ≈ 1 kg de grasa corporal (constante del PoC). */
export const KCAL_PER_KG = 7700;
export const MIN_WEIGHINS = 8;
export const MIN_SPAN_DAYS = 7;

/** Ventana canónica de la cifra que manda: idéntica en pantalla, Chat, Coach y Visita. */
export const CANONICAL_WINDOW_DAYS = 30;
/** Ampliación declarada cuando la canónica no reúne muestra suficiente. */
export const WIDENED_WINDOW_DAYS = 90;

export interface DeficitWindow {
  /** Primer día incluido (clave de día Europe/Madrid). */
  from: string;
  /** Último día incluido. */
  to: string;
}

export interface DeficitResult {
  /** ¿Hay datos suficientes (≥8 pesajes en ≥7 días)? */
  enough: boolean;
  weighins: number;
  spanDays: number;
  /** kg/semana (pendiente de la ma7). Negativo = pierde peso. */
  kgPerWeek: number | null;
  /** Déficit kcal/día (positivo = déficit real). */
  deficitKcal: number | null;
  /** Ingesta media de días con registro en fase Normal (kcal). */
  intakeMean: number | null;
  /** TDEE real (kcal). */
  tdee: number | null;
  /** Días naturales de la ventana pedida (no de la muestra). */
  windowDays: number;
  windowFrom: string;
  windowTo: string;
  /** true si se amplió a 90 d por muestra insuficiente en la canónica. */
  widened: boolean;
}

function notEnough(
  weighins: number,
  spanDays: number,
  window: DeficitWindow,
  widened: boolean,
): DeficitResult {
  return {
    enough: false,
    weighins,
    spanDays,
    kgPerWeek: null,
    deficitKcal: null,
    intakeMean: null,
    tdee: null,
    windowDays: daysBetween(window.from, window.to) + 1,
    windowFrom: window.from,
    windowTo: window.to,
    widened,
  };
}

/**
 * Déficit real sobre una ventana explícita. `records` debe ser el histórico
 * COMPLETO: la ma7 del borde izquierdo necesita ver los 6 días anteriores a
 * `window.from`, que por definición quedan fuera de la ventana.
 */
export function computeDeficit(
  records: readonly AnalyticsRecord[],
  window: DeficitWindow,
  widened = false,
): DeficitResult {
  // Serie elegible COMPLETA (para la ma7) y su recorte a la ventana (para los bordes).
  const fullSeries = eligibleWeightSeries(records);
  const inWindow = fullSeries.filter(
    (point) => point.date >= window.from && point.date <= window.to,
  );
  const weighins = inWindow.length;
  if (weighins < MIN_WEIGHINS) return notEnough(weighins, 0, window, widened);

  const first = inWindow[0]!.date;
  const last = inWindow[inWindow.length - 1]!.date;
  const spanDays = daysBetween(first, last);
  if (spanDays < MIN_SPAN_DAYS) return notEnough(weighins, spanDays, window, widened);

  // ma7 sobre la serie completa: el borde izquierdo ve sus 6 días previos reales.
  const ma7First = ma7At(fullSeries, first) as number;
  const ma7Last = ma7At(fullSeries, last) as number;
  const kgPerWeek = ((ma7Last - ma7First) / spanDays) * 7;
  const deficitKcal = Math.round((-kgPerWeek * KCAL_PER_KG) / 7);

  const normalLogged = records.filter(
    (r) => r.logged && r.phase == null && r.date >= window.from && r.date <= window.to,
  );
  const rawIntake =
    normalLogged.length > 0
      ? normalLogged.reduce((acc, r) => acc + r.kcal, 0) / normalLogged.length
      : null;
  const tdee = rawIntake != null ? Math.round(rawIntake + deficitKcal) : null;

  return {
    enough: true,
    weighins,
    spanDays,
    kgPerWeek,
    deficitKcal,
    intakeMean: rawIntake != null ? Math.round(rawIntake) : null,
    tdee,
    windowDays: daysBetween(window.from, window.to) + 1,
    windowFrom: window.from,
    windowTo: window.to,
    widened,
  };
}

/** Ventana natural inclusiva terminada hoy: 30 d = hoy y los 29 anteriores. */
export function trailingWindow(today: string, days: number): DeficitWindow {
  return { from: shiftDayKey(today, -(days - 1)), to: today };
}

/**
 * LA cifra que manda (principio 1). Ventana canónica de 30 d; si no reúne muestra
 * (≥8 pesajes en ≥7 días) se amplía a 90 d y lo declara con `widened`, para que la
 * UI y la IA lo digan en vez de fingir una ventana que no es.
 *
 * El selector 14/30/90/todo de Progreso NO la afecta: manda sobre los gráficos.
 */
export function computeCanonicalDeficit(
  records: readonly AnalyticsRecord[],
  today: string,
): DeficitResult {
  const canonical = computeDeficit(records, trailingWindow(today, CANONICAL_WINDOW_DAYS));
  if (canonical.enough) return canonical;
  return computeDeficit(records, trailingWindow(today, WIDENED_WINDOW_DAYS), true);
}
