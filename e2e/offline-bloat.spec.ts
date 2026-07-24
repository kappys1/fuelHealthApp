import { expect, test } from "@playwright/test";

interface DayBloatPayload {
  bloatEvents: Array<{
    id: number;
    severity: string;
    occurredAt: string;
  }>;
}

function freeTimes(events: DayBloatPayload["bloatEvents"], count: number): string[] {
  const occupied = new Set(events.map((event) => event.occurredAt.slice(0, 5)));
  return Array.from({ length: 24 * 60 }, (_, minute) => {
    const hours = String(Math.floor(minute / 60)).padStart(2, "0");
    const minutes = String(minute % 60).padStart(2, "0");
    return `${hours}:${minutes}`;
  })
    .filter((time) => !occupied.has(time))
    .slice(0, count);
}

test.describe("Hinchazón offline", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
  });

  test("crea el marcador sin red y lo sincroniza al reconectar", async ({
    context,
    page,
  }) => {
    await page.goto("/hoy");
    await expect(page.getByRole("heading", { name: "Contexto del día" })).toBeVisible();

    const dayResponse = await page.request.get("/api/day");
    expect(dayResponse.ok()).toBe(true);
    const day = (await dayResponse.json()) as DayBloatPayload;
    const [occurredAt] = freeTimes(day.bloatEvents, 1);
    expect(occurredAt).toBeTruthy();

    let createdId: number | null = null;
    try {
      await context.setOffline(true);
      await page
        .getByRole("button", { name: "Registrar otro marcador de hinchazón con hora" })
        .click();
      const dialog = page.getByRole("dialog", { name: "Registrar hinchazón" });
      await dialog.getByRole("button", { name: "Alta" }).click();
      await dialog.getByLabel("Hora").fill(occurredAt as string);
      await dialog.getByRole("button", { name: "Guardar marcador" }).click();

      await expect(dialog).toBeHidden();
      await expect(page.getByText("1 registro pendiente")).toBeVisible();

      const synced = page.waitForResponse(
        (response) =>
          response.url().endsWith("/api/bloat-events") &&
          response.request().method() === "POST" &&
          response.ok(),
      );
      await context.setOffline(false);
      const response = await synced;
      const body = (await response.json()) as { event: { id: number } };
      createdId = body.event.id;

      await expect(
        page
          .locator('section[role="status"]')
          .filter({ hasText: /registro pendiente|Sincronizando cambios/ }),
      ).toHaveCount(0);
      const persistedResponse = await page.request.get("/api/day");
      const persisted = (await persistedResponse.json()) as DayBloatPayload;
      expect(persisted.bloatEvents).toContainEqual(
        expect.objectContaining({
          id: createdId,
          severity: "alta",
          occurredAt: expect.stringMatching(new RegExp(`^${occurredAt}`)),
        }),
      );
    } finally {
      await context.setOffline(false);
      if (createdId !== null) {
        const cleanup = await page.request.delete(`/api/bloat-events/${createdId}`);
        expect(cleanup.ok()).toBe(true);
      }
    }
  });

  test("conserva una edición y una eliminación hechas durante el replay", async ({
    context,
    page,
  }) => {
    await page.goto("/hoy");
    await expect(page.getByRole("heading", { name: "Contexto del día" })).toBeVisible();

    const initialResponse = await page.request.get("/api/day");
    expect(initialResponse.ok()).toBe(true);
    const initial = (await initialResponse.json()) as DayBloatPayload;
    const [originalTime, editedTime, deletedTime] = freeTimes(initial.bloatEvents, 3);
    expect(originalTime).toBeTruthy();
    expect(editedTime).toBeTruthy();
    expect(deletedTime).toBeTruthy();

    const persistedIds = new Set<number>();
    let releasePost: (() => void) | null = null;

    const createOfflineMarker = async (time: string) => {
      await context.setOffline(true);
      await page
        .getByRole("button", { name: "Registrar otro marcador de hinchazón con hora" })
        .click();
      const dialog = page.getByRole("dialog", { name: "Registrar hinchazón" });
      await dialog.getByRole("button", { name: "Alta" }).click();
      await dialog.getByLabel("Hora").fill(time);
      await dialog.getByRole("button", { name: "Guardar marcador" }).click();
      await expect(dialog).toBeHidden();
    };

    const delayNextCreate = async () => {
      let signalStarted: (() => void) | null = null;
      const started = new Promise<void>((resolve) => {
        signalStarted = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        releasePost = resolve;
      });
      await page.route("**/api/bloat-events", async (route) => {
        if (route.request().method() !== "POST") {
          await route.continue();
          return;
        }
        signalStarted?.();
        await gate;
        await route.continue();
      });
      await context.setOffline(false);
      await started;
    };

    try {
      await createOfflineMarker(originalTime!);
      await delayNextCreate();

      await page
        .getByRole("button", {
          name: new RegExp(`Hinchazón alta.*${originalTime}`),
        })
        .click();
      const editDialog = page.getByRole("dialog", { name: "Editar hinchazón" });
      await editDialog.getByRole("button", { name: "Moderada" }).click();
      await editDialog.getByLabel("Hora").fill(editedTime!);
      const patchResponse = page.waitForResponse(
        (response) =>
          /\/api\/bloat-events\/\d+$/.test(new URL(response.url()).pathname) &&
          response.request().method() === "PATCH" &&
          response.ok(),
      );
      await editDialog.getByRole("button", { name: "Guardar marcador" }).click();
      releasePost?.();
      releasePost = null;
      const patched = await patchResponse;
      persistedIds.add(Number(new URL(patched.url()).pathname.split("/").at(-1)));
      await page.unroute("**/api/bloat-events");
      await expect(
        page
          .locator('section[role="status"]')
          .filter({ hasText: /registro pendiente|Sincronizando cambios/ }),
      ).toHaveCount(0);

      const editedResponse = await page.request.get("/api/day");
      const edited = (await editedResponse.json()) as DayBloatPayload;
      expect(edited.bloatEvents).toContainEqual(
        expect.objectContaining({
          severity: "moderada",
          occurredAt: expect.stringMatching(new RegExp(`^${editedTime}`)),
        }),
      );
      expect(
        edited.bloatEvents.some((event) => event.occurredAt.startsWith(originalTime!)),
      ).toBe(false);

      await createOfflineMarker(deletedTime!);
      await delayNextCreate();
      await page
        .getByRole("button", {
          name: new RegExp(`Hinchazón alta.*${deletedTime}`),
        })
        .click();
      const deleteDialog = page.getByRole("dialog", { name: "Editar hinchazón" });
      const deleteResponse = page.waitForResponse(
        (response) =>
          /\/api\/bloat-events\/\d+$/.test(new URL(response.url()).pathname) &&
          response.request().method() === "DELETE" &&
          response.ok(),
      );
      await deleteDialog.getByRole("button", { name: "Eliminar marcador" }).click();
      releasePost?.();
      releasePost = null;
      await deleteResponse;
      await page.unroute("**/api/bloat-events");
      await expect(
        page
          .locator('section[role="status"]')
          .filter({ hasText: /registro pendiente|Sincronizando cambios/ }),
      ).toHaveCount(0);

      const deletedResponse = await page.request.get("/api/day");
      const deleted = (await deletedResponse.json()) as DayBloatPayload;
      expect(
        deleted.bloatEvents.some((event) => event.occurredAt.startsWith(deletedTime!)),
      ).toBe(false);
    } finally {
      releasePost?.();
      await context.setOffline(false);
      await page.unroute("**/api/bloat-events").catch(() => undefined);
      const finalResponse = await page.request.get("/api/day");
      if (finalResponse.ok()) {
        const finalDay = (await finalResponse.json()) as DayBloatPayload;
        for (const event of finalDay.bloatEvents) {
          if (
            persistedIds.has(event.id) ||
            [originalTime, editedTime, deletedTime].some(
              (time) => time && event.occurredAt.startsWith(time),
            )
          ) {
            await page.request.delete(`/api/bloat-events/${event.id}`);
          }
        }
      }
    }
  });
});
