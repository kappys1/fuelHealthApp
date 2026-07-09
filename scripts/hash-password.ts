import { hash } from "@node-rs/argon2";

/**
 * Genera el hash argon2 del password de Alex para AUTH_PASSWORD_HASH.
 * Uso: pnpm hash-password '<password>'
 */
async function main() {
  const password = process.argv[2];
  if (!password) {
    console.error("Uso: pnpm hash-password '<password>'");
    process.exit(1);
  }
  console.log(await hash(password));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
