import path from "node:path";
import { expect, test } from "@playwright/test";

/*
  Flujo crítico 4 · Import CSV de Health Auto Export con vista previa (07 §4 / F4.2).
  Llega SOLO a la vista previa (parse en servidor + lectura de BD), NO pulsa «Aplicar
  import» → no escribe. Por eso corre siempre (sin E2E_ALLOW_WRITES).
*/
test("import CSV muestra la vista previa (sin aplicar)", async ({ page }) => {
  await page.goto("/ajustes");

  await page.getByRole("button", { name: /Elegir CSV de Health Auto Export/ }).click();
  await page
    .locator('input[type="file"][accept*="csv"]')
    .setInputFiles(path.join(__dirname, "fixtures", "hae-sample.csv"));

  // Resumen de la vista previa (07 §4): filas con fecha + métricas detectadas.
  await expect(page.getByText(/filas con fecha/)).toBeVisible();
  await expect(page.getByText(/métricas detectadas/)).toBeVisible();

  // El botón de aplicar existe pero NO se pulsa (este test no escribe).
  await expect(page.getByRole("button", { name: /Aplicar import/ })).toBeVisible();
});
