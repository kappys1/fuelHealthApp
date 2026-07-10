import { audit } from "../src/lib/contrast";

// CLI: imprime la tabla de contrastes y sale con 1 si algún par bloqueante falla.
const { rows, failures } = audit();

let currentTheme = "";
for (const row of rows) {
  if (row.theme !== currentTheme) {
    currentTheme = row.theme;
    console.log(`\n=== Tema ${currentTheme.toUpperCase()} ===`);
  }
  const mark = !row.gating ? "·" : row.ok ? "✓" : "✗";
  console.log(
    `${mark} ${row.ratio.toFixed(2).padStart(5)}:1  (min ${row.min})  ${row.label}`,
  );
}

console.log("");
if (failures > 0) {
  console.error(`✗ ${failures} par(es) NO cumplen su umbral de contraste.`);
  process.exit(1);
}
console.log("✓ Todos los pares de texto cumplen AA (y los rellenos ≥3:1).");
