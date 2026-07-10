/*
  Reintento breve para operaciones transitorias. Motivo (Fase 2): Neon usa
  scale-to-zero; la PRIMERA query tras un periodo de inactividad puede fallar en
  el driver `neon-http` (no reintenta). Un reintento corto absorbe ese arranque
  en frío sin ocultar errores reales (si falla las N veces, se propaga).
*/
export async function retry<T>(
  fn: () => Promise<T>,
  tries = 2,
  delayMs = 250,
): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw last;
}
