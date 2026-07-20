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
