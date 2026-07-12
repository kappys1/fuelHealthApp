import { streamText } from "ai";
import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { computeAdherence } from "@/server/analytics/adherence";
import { computeDeficit } from "@/server/analytics/deficit";
import { runText } from "@/server/ai/client";
import {
  dayLines,
  medLines,
  planSummary,
  trendAndAdherence,
} from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { chatSummaryPrompt, chatSystemPrompt } from "@/server/ai/prompts";
import { resolveModel } from "@/server/ai/provider";
import {
  addChatMessage,
  CHAT_WINDOW,
  createThread,
  getThread,
  saveThreadSummary,
  SUMMARY_BATCH,
  threadTitleFrom,
  touchThread,
} from "@/server/db/queries/chat";
import { listMed } from "@/server/db/queries/med";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrendData } from "@/server/db/queries/trend";

/*
  F-IA-8 · Chat sobre tus datos. Respuesta en streaming (SSE/texto) para sensación
  profesional. temperature 0.3 (única excepción a temp 0: es conversación, no
  medición). Contexto FRESCO por turno: dieta vigente + tendencia/adherencia + MED
  + últimos 30 días + resumen cacheado del historial largo. Guardarraíles del
  principio 8 viven en el system prompt (chatSystemPrompt): observa, no prescribe.
*/
const bodyZ = z.object({
  threadId: z.number().int().positive().nullable().optional(),
  message: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;
  const { message } = parsed.data;

  const today = dayKey();

  // 1) Hilo + persistir el mensaje del usuario ANTES de responder.
  let threadId: number;
  try {
    threadId =
      parsed.data.threadId ??
      (await retry(() => createThread(threadTitleFrom(message))));
    await retry(() => addChatMessage(threadId, "user", message));
  } catch (err) {
    return serverError(err);
  }

  // 2) Contexto de datos (fresco) + historial del hilo.
  let system: string;
  let modelMessages: { role: "user" | "assistant"; content: string }[];
  try {
    const [plan, trend, meds, detail] = await Promise.all([
      retry(() => getPlanContext(today)),
      retry(() => getTrendData(today)),
      retry(() => listMed()),
      retry(() => getThread(threadId)),
    ]);
    if (!detail) return serverError(new Error("Hilo no encontrado."));

    const deficit = computeDeficit(trend.records);
    const adherence = computeAdherence(trend.records, today, 14);
    const lastWeight =
      [...trend.records].reverse().find((r) => r.weight != null)?.weight ?? 92;

    // Historial: últimos 12 verbatim; los anteriores, resumen cacheado por lotes.
    const all = detail.messages;
    const prior = all.slice(0, Math.max(0, all.length - CHAT_WINDOW));
    const windowMsgs = all.slice(Math.max(0, all.length - CHAT_WINDOW));

    let priorSummary = detail.summary;
    let summaryCovers = detail.summaryMsgCount;
    let unsummarized = prior.slice(summaryCovers);
    if (unsummarized.length >= SUMMARY_BATCH) {
      const transcript = prior
        .map((m) => `${m.role === "user" ? "Atleta" : "Asistente"}: ${m.content}`)
        .join("\n");
      priorSummary = await runText({
        kind: "coach",
        task: "coach",
        prompt: chatSummaryPrompt(transcript),
        maxOutputTokens: 300,
      });
      summaryCovers = prior.length;
      unsummarized = [];
      await saveThreadSummary(threadId, priorSummary, summaryCovers).catch(() => {});
    }

    system = chatSystemPrompt({
      pesoReciente: lastWeight,
      planSummary: plan
        ? planSummary(plan.targets, plan.optionsByMeal)
        : "Sin plan de dieta configurado.",
      trendAdherence: trendAndAdherence(deficit, adherence),
      meds: medLines(meds),
      days30: dayLines(trend.records, 30),
      priorSummary: prior.length > 0 ? priorSummary : null,
    });

    modelMessages = [...unsummarized, ...windowMsgs].map((m) => ({
      role: m.role,
      content: m.content,
    }));
  } catch (err) {
    return serverError(err);
  }

  // 3) Streaming de la respuesta + persistencia al terminar.
  try {
    const result = streamText({
      model: resolveModel("coach"),
      system,
      messages: modelMessages,
      temperature: 0.3,
      // thinking "medium": respuestas mejor razonadas sobre tus datos. Presupuesto
      // amplio para que quepan thinking + texto sin truncar (los tokens de thinking
      // cuentan aquí, DECISIONS #48).
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "medium" } } },
      maxOutputTokens: 4096,
      onFinish: async ({ text }) => {
        if (!text.trim()) return;
        try {
          await addChatMessage(threadId, "assistant", text);
          await touchThread(threadId);
        } catch {
          /* persistencia best-effort: el usuario ya vio la respuesta */
        }
      },
    });
    return result.toTextStreamResponse({
      headers: { "X-Thread-Id": String(threadId) },
    });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
