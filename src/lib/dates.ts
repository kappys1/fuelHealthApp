import { addDays, differenceInCalendarDays } from "date-fns";
import { es } from "date-fns/locale";
import { formatInTimeZone } from "date-fns-tz";

/**
 * "Día" en Fuelboard es SIEMPRE Europe/Madrid (02-ARQUITECTURA, 03-DATOS).
 * PROHIBIDO usar `new Date().toISOString().slice(0,10)` para claves de día:
 * eso da el día en UTC y desplaza la clave por la noche.
 */
export const APP_TZ = "Europe/Madrid";

/** Clave de día 'YYYY-MM-DD' en Europe/Madrid para un instante dado. */
export function dayKey(date: Date = new Date()): string {
  return formatInTimeZone(date, APP_TZ, "yyyy-MM-dd");
}

/** Etiqueta legible corta (p. ej. "mié 9 jul") — presentación en UI. */
export function shortDayLabel(date: Date = new Date()): string {
  return formatInTimeZone(date, APP_TZ, "EEE d LLL", { locale: es });
}

/** Hora del día "HH:mm" en Europe/Madrid para un instante dado (coach: timing). */
export function timeOfDay(date: Date = new Date()): string {
  return formatInTimeZone(date, APP_TZ, "HH:mm");
}

/** Instante "seguro" (mediodía UTC) para una clave de día — evita saltos de TZ. */
function keyToInstant(key: string): Date {
  return new Date(`${key}T12:00:00Z`);
}

/** Desplaza una clave de día ±n días (para navegar ‹ hoy › en Hoy). */
export function shiftDayKey(key: string, days: number): string {
  return formatInTimeZone(addDays(keyToInstant(key), days), APP_TZ, "yyyy-MM-dd");
}

/** Etiqueta corta de una clave de día ('2026-07-08' → "mié 8 jul"). */
export function labelForKey(key: string): string {
  return shortDayLabel(keyToInstant(key));
}

/** Día ISO de la semana (1=lunes … 7=domingo) de una clave de día en Madrid. */
export function isoWeekday(key: string): number {
  return Number(formatInTimeZone(keyToInstant(key), APP_TZ, "i"));
}

/** Nombre del día de la semana en español ('2026-07-13' → "lunes"). */
export function weekdayName(key: string): string {
  return formatInTimeZone(keyToInstant(key), APP_TZ, "EEEE", { locale: es });
}

/** Valida una clave 'YYYY-MM-DD'. */
export function isDayKey(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  try {
    return dayKey(keyToInstant(s)) === s;
  } catch {
    return false;
  }
}

/** Día navegable de Hoy: calendario válido y nunca posterior al día actual. */
export function selectedDay(raw: string | null | undefined, today = dayKey()): string {
  return raw && isDayKey(raw) && raw <= today ? raw : today;
}

/** Días de calendario entre dos claves de día (b − a). Positivo si b es posterior. */
export function daysBetween(a: string, b: string): number {
  return differenceInCalendarDays(keyToInstant(b), keyToInstant(a));
}

/*
  Meses naturales (F22 · trayectoria). Aritmética sobre la clave, no sobre `Date`:
  `startOfMonth`/`endOfMonth` de date-fns trabajan en la zona del sistema y con el
  instante "mediodía UTC" podrían saltar de mes en los bordes (día 1 y último día).
  La clave 'YYYY-MM' es ya la verdad; solo el rótulo se formatea en Europe/Madrid.
*/

/** Clave de mes 'YYYY-MM' de una clave de día ('2026-07-08' → '2026-07'). */
export function monthKeyOf(key: string): string {
  return key.slice(0, 7);
}

/** Desplaza una clave de mes ±n meses ('2026-01', −1 → '2025-12'). */
export function shiftMonthKey(monthKey: string, months: number): string {
  const [year, month] = monthKeyOf(monthKey).split("-").map(Number);
  const zeroBased = (year as number) * 12 + ((month as number) - 1) + months;
  const y = Math.floor(zeroBased / 12);
  const m = zeroBased - y * 12 + 1;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`;
}

/** Primer día del mes como clave de día ('2026-07' → '2026-07-01'). */
export function startOfMonthKey(monthKey: string): string {
  return `${monthKeyOf(monthKey)}-01`;
}

/** Último día del mes como clave de día ('2026-02' → '2026-02-28'). */
export function endOfMonthKey(monthKey: string): string {
  const [year, month] = monthKeyOf(monthKey).split("-").map(Number);
  // Día 0 del mes siguiente = último día de este mes (UTC puro, sin zona).
  const last = new Date(Date.UTC(year as number, month as number, 0)).getUTCDate();
  return `${monthKeyOf(monthKey)}-${String(last).padStart(2, "0")}`;
}

/** Rótulo corto de un mes en español ('2026-07' → "jul"). */
export function monthLabel(monthKey: string): string {
  return formatInTimeZone(keyToInstant(startOfMonthKey(monthKey)), APP_TZ, "LLL", {
    locale: es,
  }).replace(/\.$/, "");
}
