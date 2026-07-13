import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

/*
  Renderer de markdown mínimo (coach/chat/visita). El parseo de tablas GFM es
  frágil (detección por separador + troceo de celdas) → se testea aquí. El resto
  (negrita, listas, headings) queda cubierto de forma indirecta.
*/
const html = (text: string) =>
  renderToStaticMarkup(createElement(Markdown, { text }));

describe("Markdown · tablas GFM", () => {
  it("renderiza una tabla con cabecera, celdas y negrita inline", () => {
    const md =
      "| Macro | Hoy |\n| :--- | ---: |\n| **Calorías** | 1741 kcal |\n| Proteína | 119 g |";
    const out = html(md);
    expect(out).toContain("<table");
    expect(out).toContain("<th");
    expect(out).toContain("Macro");
    expect(out).toContain("1741 kcal");
    expect(out).toContain("<strong>Calorías</strong>");
    // Alineación derivada del separador (2ª columna ---: → derecha).
    expect(out).toContain("text-right");
  });

  it("una tabla pegada a un párrafo no se traga en el párrafo", () => {
    const md = "Balance:\n| A | B |\n| :--- | :--- |\n| 1 | 2 |";
    const out = html(md);
    expect(out).toContain("<p>Balance:</p>");
    expect(out).toContain("<table");
  });

  it("no confunde texto con `|` suelto (sin separador) con una tabla", () => {
    const out = html("Peso | grasa sin tabla real");
    expect(out).not.toContain("<table");
    expect(out).toContain("<p>");
  });
});
