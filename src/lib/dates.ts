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
  return formatInTimeZone(date, APP_TZ, "EEE d LLL");
}
