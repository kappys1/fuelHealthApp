import { expect, test } from "@playwright/test";

/*
  Flujo crítico 3 · Check-in matinal de peso (09 §5b). El shortcut «Peso de hoy»
  (?checkin=weight) abre el sheet exprés. ESCRIBE en BD → protegido por
  E2E_ALLOW_WRITES.
*/
test.describe("Check-in matinal", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
  });

  test("registra el peso desde el sheet exprés", async ({ page }) => {
    await page.goto("/hoy?checkin=weight");

    // Sheet exprés de peso.
    await expect(page.getByRole("heading", { name: "Peso de hoy" })).toBeVisible();

    // Fija el peso en el stepper.
    const weight = page.getByLabel("Peso");
    await weight.fill("92,5");

    // Hinchazón opcional.
    await page.getByRole("button", { name: "Leve" }).click();

    // Guarda y comprueba que «Mi día» refleja el peso (formato es-ES: «92,5 kg»).
    await page.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByText(/92,5\s*kg/)).toBeVisible();
  });
});
