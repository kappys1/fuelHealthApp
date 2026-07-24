import { expect, test } from "@playwright/test";

/*
  Flujo crítico 2 · Foto de principio a fin (F-IA-1). La respuesta de /api/ai/photo
  se MOCKEA (sin coste ni latencia de IA, determinista). ESCRIBE en BD al añadir →
  protegido por E2E_ALLOW_WRITES.
*/

// JPEG 2×2 rojo válido (para que el resize por canvas del cliente lo decodifique).
const RED_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////wAARCAACAAIDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD+/iiiigD/2Q==";

test.describe("Foto de comida", () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
    // Mock del análisis de foto (forma photoResultZ, la ruta devuelve el objeto crudo).
    await page.route("**/api/ai/photo", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [
            { nombre: "Pechuga de pollo", gramos: 150, kcal: 248, proteina_g: 46, carbohidratos_g: 0, grasa_g: 5 },
            { nombre: "Arroz blanco", gramos: 120, kcal: 156, proteina_g: 3, carbohidratos_g: 34, grasa_g: 0 },
            { nombre: "Aguacate", gramos: 50, kcal: 80, proteina_g: 1, carbohidratos_g: 4, grasa_g: 7 },
          ],
          encaja_plan: true,
          comentario: "Plato equilibrado, encaja bien en tu comida.",
        }),
      });
    });
    // El almacenamiento también se mockea: validamos el contrato de la UI sin
    // crear blobs externos durante el E2E.
    await page.route("**/api/photos", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ url: "/api/photos/view?p=e2e-photo" }),
      });
    });
  });

  test("analiza una foto mockeada y añade el desglose", async ({ page }) => {
    const createdIds: number[] = [];
    try {
      await page.goto("/hoy", { waitUntil: "domcontentloaded" });
      // El FAB llega en el HTML del servidor. Esperamos el titulo que HoyClient
      // calcula al hidratar para no perder el click en el markup aun inerte.
      await expect.poll(() => page.title()).toMatch(/· Fuelboard$/);
      await page.getByRole("button", { name: /Añadir comida/ }).click();

      // Capa 1 → acceso «Foto».
      await page.getByRole("button", { name: "Foto" }).click();

      // Sube la imagen al input de archivo (oculto).
      await page.locator('input[type="file"][accept*="image"]').setInputFiles({
        name: "plato.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from(RED_JPEG_B64, "base64"),
      });

      // Analiza y espera el desglose mockeado.
      await page.getByRole("button", { name: /Analizar foto|Reanalizar/ }).click();
      await expect(page.getByText("Pechuga de pollo")).toBeVisible();
      await expect(page.getByText(/Total:/)).toBeVisible();

      // Añade los 3 items por separado y comprueba el contrato persistido.
      const persisted = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/entries") &&
          response.request().method() === "POST" &&
          response.ok(),
      );
      await page.getByRole("button", { name: "Añadir por separado" }).click();
      const response = await persisted;
      const body = (await response.json()) as { entries: Array<{ id: number }> };
      createdIds.push(...body.entries.map((entry) => entry.id));

      // La lectura agregada de Hoy debe devolver exactamente el lote recién creado.
      const dayResponse = await page.request.get("/api/day");
      expect(dayResponse.ok()).toBe(true);
      const day = (await dayResponse.json()) as {
        view: { entries: Array<{ id: number; name: string }> };
      };
      const persistedEntries = day.view.entries.filter((entry) =>
        createdIds.includes(entry.id),
      );
      expect(persistedEntries.map((entry) => entry.name).sort()).toEqual(
        ["Pechuga de pollo", "Arroz blanco", "Aguacate"].sort(),
      );
    } finally {
      for (const id of createdIds) {
        const cleanup = await page.request.delete(`/api/entries/${id}`);
        expect(cleanup.ok()).toBe(true);
      }
    }
  });

  test("el share target sin imagen abre el alta y explica cómo recuperarse", async ({
    page,
  }) => {
    await page.goto("/hoy?share=1");
    await expect(page.getByRole("dialog", { name: "Añadir" })).toBeVisible();
    await expect(
      page.getByText("No se encontró la imagen compartida", { exact: false }),
    ).toBeVisible();
  });
});
