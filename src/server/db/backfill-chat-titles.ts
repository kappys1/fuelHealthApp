import { config } from "dotenv";
// Cargar env ANTES de crear el cliente Neon / tocar la IA (scripts fuera de Next).
config({ path: ".env.local" });
config();

import { neon } from "@neondatabase/serverless";
import { and, asc, eq, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import {
  sanitizeThreadTitle,
  threadTitleFrom,
  TITLE_MAX_OUTPUT_TOKENS,
} from "../../lib/chat-title";
import { runText } from "../ai/client";
import { chatTitlePrompt } from "../ai/prompts";
import * as schema from "./schema";

// OJO: los helpers de título se importan del módulo PURO (`lib/chat-title`), NO de
// `./queries/chat`. Ese re-exporta desde `@/server/db`, que crea el cliente Neon de
// forma eager al cargarse; como los imports se evalúan ANTES que `config()`, el
// cliente se crearía sin DATABASE_URL y el script petaría (igual que seed/migrate,
// que crean su Drizzle inline y nunca tocan `@/server/db`).

/*
  Backfill de títulos de hilo (F12 · §6, AC7). Regenera el título de los hilos
  existentes con el modelo Flash-Lite (AI_MODEL_TITLE), igual que el hook del primer
  turno. DRY-RUN POR DEFECTO: no escribe nada; imprime old→new para revisar. Solo con
  `--write` aplica (y sigue imprimiendo old→new, para poder revertir a mano si hiciera
  falta → "explícito y reversible").

  Si la IA falla o no da nada usable para un hilo, cae al recorte determinista
  (threadTitleFrom del primer mensaje) → nunca deja un hilo sin título.

  Uso: pnpm backfill:chat-titles           (dry-run, no escribe)
       pnpm backfill:chat-titles --write   (aplica)
*/

async function main() {
  const write = process.argv.includes("--write");
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL. Ejecuta `vercel env pull .env.local` o rellena .env.local.",
    );
  }

  const db = drizzle({
    client: neon(process.env.DATABASE_URL),
    schema,
    casing: "snake_case",
  });

  const threads = await db
    .select({ id: schema.chatThreads.id, title: schema.chatThreads.title })
    .from(schema.chatThreads)
    .orderBy(asc(schema.chatThreads.id));

  console.log(
    `\n── Backfill de títulos de chat (F12) ${write ? "[WRITE]" : "[DRY-RUN]"} ──`,
  );
  console.log(`  Hilos: ${threads.length}\n`);

  let changed = 0;
  let aiFallbacks = 0;
  for (const t of threads) {
    // Primer par pregunta/respuesta del hilo (mensajes no vacíos, orden cronológico).
    const msgs = await db
      .select({
        role: schema.chatMessages.role,
        content: schema.chatMessages.content,
      })
      .from(schema.chatMessages)
      .where(
        and(
          eq(schema.chatMessages.threadId, t.id),
          ne(schema.chatMessages.content, ""),
        ),
      )
      .orderBy(asc(schema.chatMessages.createdAt), asc(schema.chatMessages.id));

    const question = msgs.find((m) => m.role === "user")?.content ?? "";
    if (!question.trim()) continue; // hilo sin pregunta → nada que resumir
    const reply = msgs.find((m) => m.role === "assistant")?.content ?? "";

    let title = "";
    try {
      const raw = await runText({
        kind: "title",
        task: "estimate",
        prompt: chatTitlePrompt(question, reply.slice(0, 500)),
        maxOutputTokens: TITLE_MAX_OUTPUT_TOKENS,
      });
      title = sanitizeThreadTitle(raw);
    } catch (err) {
      console.error(
        `  ! hilo ${t.id}: título IA falló (${err instanceof Error ? err.name : "error"})`,
      );
    }
    if (!title) {
      title = threadTitleFrom(question);
      aiFallbacks++;
    }
    if (title === t.title) continue;

    changed++;
    console.log(`  #${t.id}: "${t.title}" → "${title}"`);
    if (write) {
      await db
        .update(schema.chatThreads)
        .set({ title })
        .where(eq(schema.chatThreads.id, t.id));
    }
  }

  console.log(`\n  Cambios: ${changed}${aiFallbacks ? ` (${aiFallbacks} por fallback determinista)` : ""}`);
  if (!write) console.log("  (dry-run: no se escribió nada; añade --write para aplicar)");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
