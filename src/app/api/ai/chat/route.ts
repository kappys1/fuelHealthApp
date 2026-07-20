import { streamText } from "ai";
import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey, shiftDayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { CHAT_MAX_CHARS } from "@/lib/schemas";
import { computeAdherence } from "@/server/analytics/adherence";
import { computeDeficit } from "@/server/analytics/deficit";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runText } from "@/server/ai/client";
import {
  dayLines,
  marksContext,
  medLines,
  planSummary,
  recentMealsDetail,
  trendAndAdherence,
} from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { chatSummaryPrompt, chatSystemPrompt } from "@/server/ai/prompts";
import { resolveModel, webSearchTools } from "@/server/ai/provider";
import { mealEntriesInRange } from "@/server/db/queries/day";
import { listMarksWithEntries } from "@/server/db/queries/marks";
import {
  CHAT_WINDOW,
  claimAssistantTurn,
  completeAssistantTurn,
  createThread,
  deleteEmptyThread,
  ensureChatUserMessage,
  getChatTurn,
  getThread,
  releaseAssistantTurn,
  saveThreadSummary,
  SUMMARY_BATCH,
  threadTitleFrom,
  touchThread,
} from "@/server/db/queries/chat";
import { getChatWebSearch } from "@/server/db/queries/lookups";
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
  // CHAT_MAX_CHARS: cabe un menú de comedor entero pegado en el mensaje (el caso
  // real de "¿qué cojo hoy?"). Antes 2000 → rechazaba menús con 400 silencioso.
  message: z.string().min(1).max(CHAT_MAX_CHARS),
  turnId: z.uuid().optional(),
  // Compatibilidad con clientes anteriores. La deduplicación real usa turnId.
  retry: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;
  const { message } = parsed.data;
  const turnId = parsed.data.turnId ?? crypto.randomUUID();

  const today = dayKey();

  // 1) Hilo + turno persistente ANTES de responder. La pareja turnId/role es
  // única: reintentar recupera el mismo hilo aunque se perdieran las cabeceras.
  let threadId: number;
  let assistantMessageId: number;
  try {
    const existing = await retry(() => getChatTurn(turnId));
    let createdThreadId: number | null = null;
    const requestedThreadId =
      existing?.threadId ??
      parsed.data.threadId ??
      (createdThreadId = await retry(() => createThread(threadTitleFrom(message))));
    const turn = await retry(() =>
      ensureChatUserMessage(requestedThreadId, turnId, message),
    );
    threadId = turn.threadId;

    // Dos reintentos simultáneos de un hilo nuevo pueden crear una carcasa vacía;
    // el constraint elige un único turno y esta limpieza retira la perdedora.
    if (createdThreadId != null && createdThreadId !== threadId) {
      await deleteEmptyThread(createdThreadId).catch(() => undefined);
    }

    const claim = await retry(() => claimAssistantTurn(threadId, turnId));
    if (claim.status === "complete") {
      return new Response(claim.content, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Thread-Id": String(threadId),
          "X-Chat-Turn-Id": turnId,
          "X-Chat-Replayed": "1",
        },
      });
    }
    if (claim.status === "pending") {
      return Response.json(
        {
          error:
            "La respuesta de este turno sigue procesándose. Espera unos segundos y recupérala.",
        },
        {
          status: 409,
          headers: {
            "X-Thread-Id": String(threadId),
            "X-Chat-Turn-Id": turnId,
          },
        },
      );
    }
    assistantMessageId = claim.messageId;
  } catch (err) {
    return serverError(err);
  }

  // 2) Contexto de datos (fresco) + historial del hilo.
  let system: string;
  let modelMessages: { role: "user" | "assistant"; content: string }[];
  // F05 Fase 1: la tool `googleSearch` se cablea solo si `chatWebSearch` está ON
  // (mismo flag que el párrafo web del prompt). OFF → undefined → sin tool =
  // comportamiento idéntico a la Fase 0.
  let tools: ReturnType<typeof webSearchTools> | undefined;
  try {
    // Detalle por item de los últimos 7 días (F02): el chat ve QUÉ comió, no solo
    // los totales; días fuera del rango los pide (guardarraíl anti-invención).
    const detailFrom = shiftDayKey(today, -6);
    const [plan, trend, meds, detail, recentEntries, marks, webSearch] =
      await Promise.all([
        retry(() => getPlanContext(today)),
        retry(() => getTrendData(today)),
        retry(() => listMed()),
        retry(() => getThread(threadId)),
        retry(() => mealEntriesInRange(detailFrom, today)),
        retry(() => listMarksWithEntries()),
        // F05 Fase 1: interruptor global (default ON). Gobierna a la vez el
        // párrafo web del prompt y la tool `googleSearch` de streamText.
        retry(() => getChatWebSearch()),
      ]);
    if (!detail) throw new Error("Hilo no encontrado.");

    const deficit = computeDeficit(trend.records);
    const adherence = computeAdherence(trend.records, today, 14);
    const lastWeight =
      [...trend.records].reverse().find((r) => r.weight != null)?.weight ?? null;

    // ATHLETE_CONTEXT dinámico (doc 10 A2) + mapeo para el calendario del día en curso.
    const atleta = await retry(() => getAthleteContexts(today, lastWeight));

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
        // El resumen lo hace el MODELO DEL CHAT (el bueno), no Flash: preserva
        // mejor los hechos literales de Alex (menos «tengo que repetírselo»).
        kind: "chat",
        task: "coach",
        prompt: chatSummaryPrompt(transcript),
        maxOutputTokens: 600,
      });
      summaryCovers = prior.length;
      unsummarized = [];
      await saveThreadSummary(threadId, priorSummary, summaryCovers).catch(() => {});
    }

    system = chatSystemPrompt({
      atleta: atleta.full,
      today,
      planSummary: plan
        ? planSummary(plan.targets, plan.optionsByMeal)
        : "Sin plan de dieta configurado.",
      trendAdherence: trendAndAdherence(deficit, adherence),
      meds: medLines(meds),
      days30: dayLines(trend.records, 30, {
        sessionByWeekday: atleta.sessionByWeekday,
        today,
      }),
      mealsDetail: recentMealsDetail(recentEntries),
      marks: marksContext(marks),
      priorSummary: prior.length > 0 ? priorSummary : null,
      // El párrafo web y la tool `googleSearch` van atados a este mismo flag.
      webSearch,
    });

    tools = webSearch ? webSearchTools() : undefined;

    modelMessages = [...unsummarized, ...windowMsgs].map((m) => ({
      role: m.role,
      content: m.content,
    }));
  } catch (err) {
    await releaseAssistantTurn(assistantMessageId).catch(() => undefined);
    const response = serverError(err);
    response.headers.set("X-Thread-Id", String(threadId));
    response.headers.set("X-Chat-Turn-Id", turnId);
    return response;
  }

  // 3) Streaming de la respuesta + persistencia al terminar.
  try {
    const result = streamText({
      // Modelo propio del chat (AI_MODEL_CHAT), más capaz que el del coach.
      model: resolveModel("chat"),
      system,
      messages: modelMessages,
      // Grounding web (F05 Fase 1): provider-executed `googleSearch`, disparo
      // automático (Gemini decide cuándo buscar). undefined si `chatWebSearch`
      // está OFF. La cita de fuente va en el TEXTO (por prompt), no chips de
      // groundingMetadata → el streaming de texto no cambia (DECISIONS #63).
      tools,
      temperature: 0.3,
      // thinking "low" (antes "medium", DECISIONS #55): con Gemini 3.1 Pro,
      // "medium" tardaba demasiado en soltar el primer byte y comía el
      // presupuesto → el stream se cortaba en el móvil ("Load failed"). En Pro,
      // "low" razona de sobra para un chat de datos y arranca mucho antes. Techo
      // 4096 (antes 2048): hueco holgado para thinking + un menú largo sin truncar
      // (los tokens de thinking cuentan aquí, DECISIONS #48); la brevedad la fija
      // el prompt (persona + tope de palabras), no este número.
      providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } },
      maxOutputTokens: 4096,
      onError: ({ error }) => {
        console.error("[chat] stream error:", error);
        void releaseAssistantTurn(assistantMessageId).catch((persistError) => {
          console.error("[chat] no se pudo liberar el turno fallido:", persistError);
        });
      },
      onFinish: async ({ text }) => {
        if (!text.trim()) {
          await releaseAssistantTurn(assistantMessageId).catch(() => undefined);
          return;
        }
        try {
          await completeAssistantTurn(assistantMessageId, text);
          await touchThread(threadId);
        } catch (persistError) {
          // No se silencia: la UI habrá visto el stream, pero el lock permanece y
          // un reintento podrá recuperarlo o regenerarlo al expirar.
          console.error("[chat] no se pudo persistir la respuesta:", persistError);
        }
      },
    });
    return result.toTextStreamResponse({
      headers: {
        "X-Thread-Id": String(threadId),
        "X-Chat-Turn-Id": turnId,
      },
    });
  } catch (err) {
    await releaseAssistantTurn(assistantMessageId).catch(() => undefined);
    const response = aiErrorResponse(err);
    response.headers.set("X-Thread-Id", String(threadId));
    response.headers.set("X-Chat-Turn-Id", turnId);
    return response;
  }
}
