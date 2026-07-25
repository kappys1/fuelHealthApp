export interface UuidCrypto {
  randomUUID?: () => string;
  getRandomValues: <T extends ArrayBufferView | null>(array: T) => T;
}

/**
 * UUID v4 con fallback para contextos NO seguros del cliente — http por IP de
 * LAN (probar la PWA desde el iPhone contra el dev server) o Safari viejo —
 * donde `crypto.randomUUID` es `undefined` pero `getRandomValues` sí existe.
 * En servidor y en localhost/https se usa `randomUUID` nativo tal cual.
 * (DECISIONS #77 — crash real de Alex al añadir comida desde el móvil por LAN.)
 */
export function randomUUID(source: UuidCrypto = globalThis.crypto): string {
  if (typeof source.randomUUID === "function") {
    return source.randomUUID();
  }

  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
