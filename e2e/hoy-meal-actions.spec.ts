import { expect, test } from "@playwright/test";

test("cada alimento de Hoy expone edición y borrado desde la lista", async ({
  page,
}) => {
  await page.goto("/hoy");

  const meals = page.locator('section[aria-labelledby="meals-title"]');
  const expand = meals.getByRole("button", { name: "Expandir", exact: true });
  if ((await expand.count()) > 0) {
    await expand.click();
  }

  const editEntry = meals.locator('button[aria-label^="Editar "]').first();
  test.skip(
    (await editEntry.count()) === 0,
    "La base de prueba no contiene alimentos registrados.",
  );
  const editLabel = await editEntry.getAttribute("aria-label");
  const entryName = editLabel?.replace(/^Editar /, "") ?? "";

  await expect(editEntry).toBeVisible();
  await expect(
    meals.getByRole("button", { name: `Borrar ${entryName}`, exact: true }),
  ).toBeVisible();

  await editEntry.click();
  await expect(page.getByRole("dialog", { name: "Editar entrada" })).toBeVisible();
  await page.keyboard.press("Escape");
});
