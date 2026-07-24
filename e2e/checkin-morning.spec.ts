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
    const beforeResponse = await page.request.get("/api/day");
    expect(beforeResponse.ok()).toBe(true);
    const before = (await beforeResponse.json()) as {
      date: string;
      view: { day: { weight: number | null } | null };
    };

    try {
      await page.goto("/hoy?checkin=weight");

      // Sheet exprés de peso.
      await expect(page.getByRole("heading", { name: "Peso de hoy" })).toBeVisible();

      // Fija el peso en el stepper (input decimal dentro del sheet).
      const weight = page.getByRole("dialog").locator('input[inputmode="decimal"]').first();
      await weight.click();
      await weight.fill("92,5");

      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText(/92,5\s*kg/)).toBeVisible();

      // El valor sobrevive a una navegación completa: no era solo optimista.
      await page.goto("/hoy");
      await expect(page.getByText(/92,5\s*kg/)).toBeVisible();
    } finally {
      const cleanup = await page.request.patch("/api/day", {
        data: { date: before.date, patch: { weight: before.view.day?.weight ?? null } },
      });
      expect(cleanup.ok()).toBe(true);
    }
  });

  test("ignora el shortcut exprés cuando se consulta un día histórico", async ({
    page,
  }) => {
    await page.goto("/hoy?date=2001-01-02&checkin=weight");
    await expect(page.getByRole("heading", { name: "Peso de hoy" })).toBeHidden();
    await expect(page).toHaveURL(/\/hoy\?date=2001-01-02$/);
  });
});
