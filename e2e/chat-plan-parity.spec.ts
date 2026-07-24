import { expect, test } from "@playwright/test";

test.describe("Paridad visual de Chat y Plan", () => {
  test("Chat conserva bienvenida, preguntas rápidas y gestión de hilos", async ({
    page,
  }) => {
    await page.goto("/chat");

    await expect(
      page.getByRole("heading", { name: "¿Qué quieres entender hoy?" }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: "Preguntas rápidas" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Conversaciones" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "¿Cómo cierro bien el día?" }),
    ).toBeVisible();

    const manage = page.getByRole("button", { name: "Gestionar", exact: true });
    if ((await manage.count()) > 0) {
      await manage.click();
      await expect(page.getByRole("button", { name: /Borrar conversación/ }).first()).toBeVisible();
    }
  });

  test("una opción del plan se edita tocando la fila y se borra desde ella", async ({
    page,
  }) => {
    await page.goto("/plan");

    const meal = page.getByRole("button", { name: /Comida/ }).first();
    test.skip((await meal.count()) === 0, "La base de prueba no contiene una dieta activa.");
    await meal.click();

    const editOption = page.locator('button[aria-label^="Editar "]').nth(1);
    test.skip(
      (await editOption.count()) === 0,
      "La base de prueba no contiene opciones en Comida.",
    );
    const editLabel = await editOption.getAttribute("aria-label");
    const optionName = editLabel?.replace(/^Editar /, "") ?? "";
    const deleteOption = page.getByRole("button", {
      name: `Borrar ${optionName}`,
      exact: true,
    });

    await expect(editOption).toBeVisible();
    await expect(deleteOption).toBeVisible();

    await editOption.click();
    await expect(page.getByRole("textbox", { name: "Nombre" })).toBeVisible();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();

    await deleteOption.click();
    const dialog = page.getByRole("dialog", { name: "Borrar opción del plan" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(dialog).toBeHidden();
  });
});
