import { hash } from "@node-rs/argon2";

/**
 * Genera el hash argon2 del password de Alex para AUTH_PASSWORD_HASH.
 * Uso: pnpm hash-password '<password>'
 *
 * Imprime el valor en los dos formatos que hacen falta:
 *  - Vercel (y cualquier gestor de env): el hash tal cual.
 *  - .env.local: con cada `$` escapado como `\$`, porque el dotenv-expand de
 *    Next expande los `$` (incluso dentro de comillas simples) y corrompe el hash.
 */
async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Uso: pnpm hash-password '<password>'");
    process.exit(1);
  }

  const raw = await hash(password);
  const escaped = raw.replaceAll("$", "\\$");

  console.log("");
  console.log("── Vercel / dashboard de env (pega el hash tal cual) ──");
  console.log(raw);
  console.log("");
  console.log("── .env.local (cada $ escapado como \\$; pega la línea entera) ──");
  console.log(`AUTH_PASSWORD_HASH=${escaped}`);
  console.log("");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
