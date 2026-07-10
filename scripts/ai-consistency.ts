/*
  Test de consistencia de la Fase 2 (AC 06): "200 ml café con leche desnatada"
  estimado 3 veces seguidas debe dar valores iguales o casi iguales. Con Gemini
  3.x NO se fija temperature (regla de determinismo 04-IA); se usa thinking_level
  low en estimación. Uso:
    corepack pnpm@11.9.0 exec tsx scripts/ai-consistency.ts
*/
import { config } from "dotenv";
import type { EstimateResult } from "../src/server/ai/schemas";
config({ path: ".env.local" });

async function main() {
  // Import diferido: primero cargamos el env.
  const { runStructured } = await import("../src/server/ai/client");
  const { estimatePrompt } = await import("../src/server/ai/prompts");
  const { estimateZ } = await import("../src/server/ai/schemas");

  const desc = "200 ml café con leche desnatada";
  console.log(`Proveedor=${process.env.AI_PROVIDER} · modelo texto=${process.env.AI_MODEL_TEXT}`);
  console.log(`Estimando "${desc}" 3 veces…\n`);

  const runs: EstimateResult[] = [];
  for (let i = 0; i < 3; i++) {
    const r = await runStructured({
      kind: "text",
      task: "estimate",
      prompt: estimatePrompt(desc),
      schema: estimateZ,
      maxOutputTokens: 500,
    });
    runs.push(r);
    console.log(
      `#${i + 1}: kcal=${r.kcal} P=${r.proteina_g} C=${r.carbohidratos_g} G=${r.grasa_g}`,
    );
  }

  const spread = (key: "kcal" | "proteina_g" | "carbohidratos_g" | "grasa_g") => {
    const vals = runs.map((r) => r[key]);
    return Math.max(...vals) - Math.min(...vals);
  };
  console.log("\nRango (max-min) por macro:");
  console.log(
    `  kcal=${spread("kcal")} P=${spread("proteina_g")} C=${spread("carbohidratos_g")} G=${spread("grasa_g")}`,
  );
  const identical = ["kcal", "proteina_g", "carbohidratos_g", "grasa_g"].every(
    (k) => spread(k as "kcal") === 0,
  );
  console.log(identical ? "\n✅ IDÉNTICAS en las 3 llamadas" : "\n⚠️  hay variación (revisar rango arriba)");
}

main().catch((e) => {
  console.error("ERROR:", e instanceof Error ? e.message : e);
  process.exit(1);
});
