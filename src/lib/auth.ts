import { verify } from "@node-rs/argon2";

/**
 * Verifica el password de Alex contra el hash argon2 en env (usuario único).
 * El hash se genera con `pnpm hash-password` y se guarda en AUTH_PASSWORD_HASH.
 */
export async function verifyPassword(password: string): Promise<boolean> {
  const hash = process.env.AUTH_PASSWORD_HASH;
  if (!hash || !password) return false;
  try {
    return await verify(hash, password);
  } catch {
    return false;
  }
}
