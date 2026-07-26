import { expect, test } from "@playwright/test";
import { dayKey, shiftDayKey } from "../src/lib/dates";
import { trainingWeekSpan } from "../src/lib/training";

/*
  Regresión F17 · Plan admite preparar una semana futura y el importador conserva
  esa semana. Solo llega a la vista previa con IA mockeada; no escribe en BD.
*/
test("el domingo permite abrir e importar la semana siguiente", async ({ page }) => {
  const nextWeek = shiftDayKey(trainingWeekSpan(dayKey()).validFrom, 7);

  await page.route("**/api/ai/training-import", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        programa: "Programa E2E",
        etiqueta: "Semana siguiente",
        sesiones: [
          {
            clave: "T1",
            nombre: "Sesión E2E",
            tipo: "mixto",
            contenido: "Bloque completo",
            kcal_min: 500,
            kcal_max: 700,
            duracion_min: 60,
          },
        ],
      }),
    });
  });

  await page.goto(`/plan?tab=entrenos&week=${nextWeek}`);

  await expect(page).toHaveURL(new RegExp(`week=${nextWeek}`));
  await expect(page.getByLabel("Elegir semana por fecha")).toHaveValue(nextWeek);
  await expect(page.getByRole("button", { name: "Semana siguiente" })).toBeEnabled();

  await page
    .getByRole("button", { name: /Importar semana de entreno/ })
    .click();
  await page.getByRole("button", { name: "Texto", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Programación de la semana" })
    .fill("T1: sesión de prueba");
  await page.getByRole("button", { name: "Analizar con IA" }).click();

  await expect(page.getByLabel("Semana empieza el")).toHaveValue(nextWeek);
});
