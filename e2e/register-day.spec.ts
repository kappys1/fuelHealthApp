import { expect, test } from "@playwright/test";

/*
  Flujo crítico 1 · Registrar comidas del día (09 §4). Añade un producto fijado de
  1 toque (F07: los legacy migrados tienen baseG null → se añaden directos) y
  comprueba que aparece en el timeline. ESCRIBE en BD → protegido por
  E2E_ALLOW_WRITES (usar una rama de test de Neon, nunca producción).
*/
test.describe("Registrar un día", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
  });

  test("añade un producto fijado y aparece en el timeline", async ({ page }) => {
    await page.goto("/hoy");
    await expect(page.getByRole("button", { name: /Añadir comida/ })).toBeVisible();

    // Abre el sheet de añadir.
    await page.getByRole("button", { name: /Añadir comida/ }).click();

    // Capa 1: chips de «Mis productos» (los fijados). Un producto fijo (baseG null)
    // se añade de 1 toque; el chip muestra su base ("… kcal").
    await expect(page.getByRole("heading", { name: "Mis productos" })).toBeVisible();
    const firstChip = page.locator("button", { hasText: /kcal/ }).first();
    const chipName = (await firstChip.innerText()).split("\n")[0].trim();
    await firstChip.click();

    // Tras añadir, el sheet muestra el nuevo total con «Añadir otra».
    await expect(page.getByText("Añadir otra")).toBeVisible();

    // Cierra el sheet y comprueba que la entrada está en el timeline.
    await page.keyboard.press("Escape");
    await expect(page.getByText(chipName, { exact: false }).first()).toBeVisible();
  });
});
