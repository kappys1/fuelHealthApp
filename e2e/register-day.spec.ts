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

  test("ajusta el destino de un producto y aparece en el timeline", async ({ page }) => {
    const createdIds: number[] = [];
    try {
      await page.goto("/hoy");
      await expect(page.getByRole("button", { name: /Añadir comida/ })).toBeVisible();

    // Abre el sheet de añadir.
    await page.getByRole("button", { name: /Añadir comida/ }).click();

    // Capa 1: productos fijados. Tocar abre el detalle para revisar cantidad y
    // destino antes de registrar, igual que los demás caminos de alta.
    await expect(page.getByRole("heading", { name: "Mis productos" })).toBeVisible();
    const firstChip = page
      .getByRole("dialog")
      .locator("button", { hasText: /kcal/ })
      .first();
    const chipName = (await firstChip.innerText()).split("\n")[0].trim();
    await firstChip.click();

    const productDialog = page.getByRole("dialog", { name: chipName });
    await productDialog.getByRole("combobox").click();
    await page.getByRole("option", { name: "Merienda" }).click();
    const persisted = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/entries") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
      await productDialog.getByRole("button", { name: "Añadir a Merienda" }).click();
      const response = await persisted;
      const body = (await response.json()) as { entries: Array<{ id: number }> };
      createdIds.push(...body.entries.map((entry) => entry.id));

    // Tras confirmar, el sheet muestra el nuevo total con «Añadir otra».
    await expect(page.getByText("Añadir otra")).toBeVisible();

    // Cierra el sheet y comprueba que la entrada está en el timeline.
    await page.keyboard.press("Escape");
    await expect(page.getByText(chipName, { exact: false }).first()).toBeVisible();

    // Persistencia real, no solo estado optimista: recargar y abrir Merienda.
    await page.goto("/hoy");
    const meal = page.getByRole("button", { name: /Merienda/ }).first();
    if ((await meal.getAttribute("aria-expanded")) !== "true") await meal.click();
      await expect(page.getByText(chipName, { exact: false }).first()).toBeVisible();
    } finally {
      for (const id of createdIds) {
        const cleanup = await page.request.delete(`/api/entries/${id}`);
        expect(cleanup.ok()).toBe(true);
      }
    }
  });
});
