import { expect, test } from "@playwright/test";

test.describe("Coach a Chat", () => {
  test.beforeEach(() => {
    test.skip(
      !process.env.E2E_ALLOW_WRITES,
      "Escribe en BD: define E2E_ALLOW_WRITES=1 con una rama de test de Neon.",
    );
  });

  test("dos entregas concurrentes reutilizan el mismo hilo completo", async ({
    page,
  }) => {
    await page.goto("/hoy");

    const nonce = `${Date.now()}-${crypto.randomUUID()}`;
    const payload = {
      userMessage: "¿Cómo voy hoy?",
      assistantMessage: `Lectura Coach E2E ${nonce}`,
      handoffId: `coach:e2e:${nonce}`,
    };

    const responses = await Promise.all([
      page.request.post("/api/chat/threads", { data: payload }),
      page.request.post("/api/chat/threads", { data: payload }),
    ]);
    expect(responses.every((response) => response.ok())).toBe(true);

    const results = await Promise.all(
      responses.map((response) => response.json() as Promise<{ threadId: number }>),
    );
    expect(results[0].threadId).toBe(results[1].threadId);

    const threadId = results[0].threadId;
    try {
      const threadResponse = await page.request.get(`/api/chat/threads/${threadId}`);
      expect(threadResponse.ok()).toBe(true);
      const thread = (await threadResponse.json()) as {
        messages: Array<{ role: string; content: string }>;
      };
      expect(thread.messages.map(({ role, content }) => ({ role, content }))).toEqual([
        { role: "user", content: payload.userMessage },
        { role: "assistant", content: payload.assistantMessage },
      ]);
    } finally {
      const cleanup = await page.request.delete(`/api/chat/threads/${threadId}`);
      expect(cleanup.ok()).toBe(true);
    }
  });

  test("reabre la lectura de ayer sin volver a consumir IA", async ({ page }) => {
    const baseDate = "2001-01-02";
    const readingText = `Lectura de ayer en caché ${crypto.randomUUID()}`;
    let coachCalls = 0;
    await page.route("**/api/ai/coach", async (route) => {
      coachCalls++;
      const body = route.request().postDataJSON() as { mode: string };
      expect(body.mode).toBe("ayer");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          baseDate,
          targetDate: "2001-01-01",
          mode: "ayer",
          text: readingText,
          generatedAt: new Date().toISOString(),
          contextHash: "e2e-cached-yesterday",
        }),
      });
    });

    await page.goto(`/hoy?date=${baseDate}`);
    await page.getByRole("button", { name: "Ver lectura del Coach" }).click();
    const coach = page.getByRole("dialog", { name: "Coach" });
    await coach.getByRole("button", { name: "Analizar ayer" }).click();
    await expect(coach.getByText(readingText)).toBeVisible();
    expect(coachCalls).toBe(1);

    await page.keyboard.press("Escape");
    await expect(coach).toBeHidden();
    await page.getByRole("button", { name: "Ver lectura del Coach" }).click();
    await coach.getByRole("button", { name: "Analizar ayer" }).click();
    await expect(coach.getByText(readingText)).toBeVisible();
    await expect(coach.getByText("abrirla no consume IA", { exact: false })).toBeVisible();
    expect(coachCalls).toBe(1);
  });

  test("muestra el error de IA y permite reintentar sin bloquear el sheet", async ({
    page,
  }) => {
    let coachCalls = 0;
    await page.route("**/api/ai/coach", async (route) => {
      coachCalls++;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "El Coach no está disponible ahora. Reinténtalo.",
        }),
      });
    });

    await page.goto("/hoy?date=2001-01-03");
    expect(coachCalls).toBe(0);
    await page.getByRole("button", { name: "Ver lectura del Coach" }).click();
    const coach = page.getByRole("dialog", { name: "Coach" });
    await coach.getByRole("button", { name: "Analizar ayer" }).click();
    await expect(coach.getByRole("alert")).toContainText("Reinténtalo");
    expect(coachCalls).toBe(1);

    await coach.getByRole("button", { name: "Reintentar" }).click();
    await expect(coach.getByRole("alert")).toContainText("Reinténtalo");
    expect(coachCalls).toBe(2);
  });
});
