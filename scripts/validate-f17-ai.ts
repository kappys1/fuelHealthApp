import { runStructured } from "../src/server/ai/client";
import {
  trainingImportPrompt,
  wodPrompt,
} from "../src/server/ai/prompts";
import {
  trainingImportZ,
  wodZ,
} from "../src/server/ai/schemas";

const context =
  "Atleta de CrossFit avanzado, 175 cm, 92 kg. Programa vigente: The Progrm.";
const wod = `Fuerza/Halterofilia:
Clean pull 4x3 al 90 %, descanso 2 min.
Squat clean 5x2 al 80 %, descanso 2:30.
Back squat 4x5 al 75 %, descanso 3 min.

CrossFit:
5 rondas por tiempo:
12 cal Echo bike
10 burpee box jump overs
8 deadlifts 100 kg

Accesorios:
4 rondas de 30 s plancha de codos, 30 s plancha reversa y 30 s por lado plancha lateral.`;

const running = `Plan semanal de running:
Día 1 — Rodaje suave: 45 min en Z2 + 10 min de movilidad.
Día 2 — Series: calentamiento 15 min; 8 x 400 m a ritmo 5K, recuperación 90 s trotando; vuelta a la calma 10 min.
Día 3 — Descanso completo.
Día 4 — Tempo: calentamiento 15 min; 3 x 10 min a umbral, recuperación 3 min suave; vuelta a la calma 10 min.
Día 5 — Fuerza complementaria: sentadilla 4x6, peso muerto rumano 3x8, gemelos 3x15; descanso 2 min.
Día 6 — Tirada larga: 90 min en Z2, últimos 15 min progresivos.
Día 7 — Recuperación: 30 min muy suave + movilidad.`;

async function main() {
  const wodRuns = [];
  for (let index = 0; index < 3; index++) {
    wodRuns.push(
      await runStructured({
        kind: "text",
        task: "estimate",
        prompt: wodPrompt(wod, context),
        schema: wodZ,
        maxOutputTokens: 2048,
      }),
    );
    console.log(`F-IA-5 ${index + 1}/3`, JSON.stringify(wodRuns.at(-1)));
  }

  const trainingRuns = [];
  for (let index = 0; index < 3; index++) {
    trainingRuns.push(
      await runStructured({
        kind: "text",
        task: "estimate",
        prompt: trainingImportPrompt(context, running),
        schema: trainingImportZ,
        maxOutputTokens: 8192,
      }),
    );
    const result = trainingRuns.at(-1)!;
    console.log(
      `F-IA-10 running ${index + 1}/3`,
      JSON.stringify({
        sesiones: result.sesiones.length,
        tipos: result.sesiones.map((session) => session.tipo),
        duraciones: result.sesiones.map((session) => session.duracion_min),
        kcal: result.sesiones.map((session) => [
          session.kcal_min,
          session.kcal_max,
        ]),
        contenidos: result.sesiones.map((session) => session.contenido),
      }),
    );
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
