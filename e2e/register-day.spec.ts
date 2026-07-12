import { expect, test } from "@playwright/test";

/*
  Flujo crítico 1 · Registrar comidas del día (09 §4). Añade un favorito de 1 toque
  y comprueba que aparece en el timeline. ESCRIBE en BD → protegido por
  E2E_ALLOW_WRITES (usar una rama de test de Neon, nunca producción).
*/
test.describe("Registrar un día", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
  });

  test("añade un favorito y aparece en el timeline", async ({ page }) => {
    await page.goto("/hoy");
    await expect(page.getByRole("button", { name: /Añadir comida/ })).toBeVisible();

    // Abre el sheet de añadir.
    await page.getByRole("button", { name: /Añadir comida/ }).click();

    // Capa 1: chips de favoritos (los 6 más usados). Añaden de 1 toque.
    await expect(page.getByRole("heading", { name: "Favoritos" })).toBeVisible();
    const firstFav = page.locator("button", { hasText: /\d+$/ }).first();
    const favName = (await firstFav.innerText()).replace(/\s*\d+\s*$/, "").trim();
    await firstFav.click();

    // Tras añadir, el sheet muestra el nuevo total con «Añadir otra».
    await expect(page.getByText("Añadir otra")).toBeVisible();

    // Cierra el sheet y comprueba que la entrada está en el timeline.
    await page.keyboard.press("Escape");
    await expect(page.getByText(favName, { exact: false }).first()).toBeVisible();
  });
});
