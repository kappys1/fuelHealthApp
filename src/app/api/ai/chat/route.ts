import { type ModelMessage, streamText } from "ai";
import { badRequest, ensureAuth, parseBody, serverError } from "@/lib/api";
import { persistedChatUserText } from "@/lib/chat-turn";
import { dayKey, shiftDayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { computeAdherence } from "@/server/analytics/adherence";
import { computeDeficit } from "@/server/analytics/deficit";
import { computeFlexibleImpact } from "@/server/analytics/flexibleImpact";
import { getAthleteContexts } from "@/server/ai/athlete";
import {
  buildChatModelMessages,
  chatRequestSchema,
} from "@/server/ai/chat-turn";
import { runText } from "@/server/ai/client";
import {
  dayLines,
  marksContext,
  medLines,
  planSummary,
  productsContext,
  recentMealsDetail,
  trendAndAdherence,
} from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { normalizeImage } from "@/server/ai/image";
import {
  persistedTextStreamResponse,
  verifiedTextDeltas,
} from "@/server/ai/persisted-text-stream";
import { planConfirmedProductSave } from "@/server/ai/product-save";
import { saveConfirmedProduct } from "@/server/ai/product-write";
import {
  chatSummaryPrompt,
  chatSystemPrompt,
  chatTitlePrompt,
} from "@/server/ai/prompts";
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
  findPendingDuplicateTurn,
  getChatTurn,
  getThread,
  releaseAssistantTurn,
  sanitizeThreadTitle,
  saveThreadSummary,
  saveThreadTitle,
  SUMMARY_BATCH,
  threadTitleFrom,
  touchThread,
} from "@/server/db/queries/chat";
import { getChatWebSearch, listProducts } from "@/server/db/queries/lookups";
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
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, chatRequestSchema);
  if ("error" in parsed) return parsed.error;
  const { message } = parsed.data;
  const turnId = parsed.data.turnId ?? crypto.randomUUID();
  const persistedMessage = persistedChatUserText(message, parsed.data.image != null);

  // F05 Fase 2: MIME/base64/8 MB ya quedaron validados por Zod. La normalización
  // (incluido HEIC→JPEG) también ocurre ANTES de crear hilo o persistir mensaje:
  // un archivo inválido nunca deja un turno huérfano.
  let image: Awaited<ReturnType<typeof normalizeImage>> | undefined;
  try {
    image = parsed.data.image
      ? await normalizeImage(parsed.data.image)
      : undefined;
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : "Imagen inválida.");
  }

  const today = dayKey();

  // 1) Hilo + turno persistente ANTES de responder. La pareja turnId/role es
  // única: reintentar recupera el mismo hilo aunque se perdieran las cabeceras.
  let threadId: number;
  let assistantMessageId: number;
  // Elevado al scope de la función: el hook de título (onComplete) necesita saber si
  // este turno creó el hilo (F12: título IA una sola vez, en el primer turno).
  let createdThreadId: number | null = null;
  try {
    const existing = await retry(() => getChatTurn(turnId));

    // F12 Fase 4 · dedup del doble envío (AC9): un turnId NUEVO en un hilo conocido
    // cuyo texto idéntico ya tiene un turno con la respuesta pendiente = doble envío.
    // Se corta ANTES de crear una segunda fila de usuario o una segunda generación;
    // se remite al turno en curso (X-Chat-Turn-Id). Repetir tras una respuesta
    // COMPLETA sí procede (findPendingDuplicateTurn no lo marca).
    if (!existing && parsed.data.threadId != null) {
      const dup = await retry(() =>
        findPendingDuplicateTurn(parsed.data.threadId!, persistedMessage),
      );
      if (dup) {
        return Response.json(
          {
            error:
              "Esa misma pregunta ya se está procesando en este hilo. Espera unos segundos y recupérala.",
          },
          {
            status: 409,
            headers: {
              "X-Thread-Id": String(parsed.data.threadId),
              "X-Chat-Turn-Id": dup.turnId,
            },
          },
        );
      }
    }

    const requestedThreadId =
      existing?.threadId ??
      parsed.data.threadId ??
      (createdThreadId = await retry(() =>
        createThread(threadTitleFrom(message.trim() || persistedMessage)),
      ));
    const turn = await retry(() =>
      ensureChatUserMessage(requestedThreadId, turnId, persistedMessage),
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
  let modelMessages: ModelMessage[];
  // F05 Fase 1: la tool `googleSearch` se cablea solo si `chatWebSearch` está ON
  // (mismo flag que el párrafo web del prompt). OFF → undefined → sin tool =
  // comportamiento idéntico a la Fase 0.
  let tools: ReturnType<typeof webSearchTools> | undefined;
  try {
    // Detalle por item de los últimos 7 días (F02): el chat ve QUÉ comió, no solo
    // los totales; días fuera del rango los pide (guardarraíl anti-invención).
    const detailFrom = shiftDayKey(today, -6);
    const [plan, trend, meds, detail, recentEntries, marks, products, webSearch] =
      await Promise.all([
        retry(() => getPlanContext(today)),
        retry(() => getTrendData(today)),
        retry(() => listMed()),
        retry(() => getThread(threadId)),
        retry(() => mealEntriesInRange(detailFrom, today)),
        retry(() => listMarksWithEntries()),
        // F12: catálogo «Mis productos» como contexto de lectura (fuente exacta de
        // un producto de marca; jerarquía de fuentes en el prompt).
        retry(() => listProducts()),
        // F05 Fase 1: interruptor global (default ON). Gobierna a la vez el
        // párrafo web del prompt y la tool `googleSearch` de streamText.
        retry(() => getChatWebSearch()),
      ]);
    if (!detail) throw new Error("Hilo no encontrado.");

    const deficit = computeDeficit(trend.records);
    const adherence = computeAdherence(trend.records, today, 14);
    const flexibleImpact = computeFlexibleImpact(trend.records, today);
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

    // F12 Fase 2: escritura CONFIRMADA de producto. Determinista en servidor: si el
    // turno anterior del asistente ofreció guardar (línea-ficha) y ESTE mensaje de
    // Alex lo confirma explícitamente, se guarda con los números del turno de oferta
    // (el modelo de este turno no los toca). Cualquier otro turno = solo lectura.
    const lastAssistant =
      [...all].reverse().find((m) => m.role === "assistant")?.content ?? null;
    const saveFicha = planConfirmedProductSave({ lastAssistant, currentUser: message });
    let justSavedProduct: string | null = null;
    if (saveFicha) {
      try {
        const saved = await saveConfirmedProduct(saveFicha);
        const verbo = saved.action === "created" ? "creado" : "actualizado";
        justSavedProduct = `${saved.name} (${saveFicha.baseG} ${saveFicha.unit} · ${saveFicha.kcal} kcal · ${saveFicha.prot}P/${saveFicha.carb}C/${saveFicha.fat}F), ${verbo}`;
      } catch (persistError) {
        // Fallo de BD al guardar: NO romper el chat ni afirmar un guardado que no
        // ocurrió. Se loguea (error de BD, separado del de IA) y el turno responde
        // sin la confirmación → Alex ve que no se guardó y puede reintentar.
        console.error(
          "[chat] no se pudo guardar el producto confirmado:",
          persistError,
        );
      }
    }

    system = chatSystemPrompt({
      atleta: atleta.full,
      today,
      planSummary: plan
        ? planSummary(plan.targets, plan.optionsByMeal)
        : "Sin plan de dieta configurado.",
      trendAdherence: trendAndAdherence(deficit, adherence, flexibleImpact),
      meds: medLines(meds),
      days30: dayLines(trend.records, 30, {
        trainingByWeekday: atleta.trainingByWeekday,
        today,
        includeCurrentPlannedFlexible: true,
      }),
      mealsDetail: recentMealsDetail(recentEntries, trend.records),
      marks: marksContext(marks),
      products: productsContext(products),
      justSavedProduct,
      priorSummary: prior.length > 0 ? priorSummary : null,
      // El párrafo web y la tool `googleSearch` van atados a este mismo flag.
      webSearch,
    });

    tools = webSearch ? webSearchTools() : undefined;

    modelMessages = buildChatModelMessages(
      [...unsummarized, ...windowMsgs],
      turnId,
      image,
      message,
    );
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
      abortSignal: request.signal,
    });
    return persistedTextStreamResponse({
      deltas: verifiedTextDeltas(result.fullStream),
      onComplete: async (text) => {
        await completeAssistantTurn(assistantMessageId, text);
        await touchThread(threadId).catch((persistError) => {
          console.error("[chat] no se pudo actualizar el hilo:", persistError);
        });
        // F12: título IA UNA sola vez, en el primer turno del hilo. Barato
        // (Flash-Lite, ~32 tokens). Si falla o queda vacío, el hilo conserva el
        // título determinista que puso createThread → nunca bloquea ni rompe.
        if (createdThreadId != null && createdThreadId === threadId) {
          try {
            const raw = await runText({
              kind: "title",
              task: "estimate",
              prompt: chatTitlePrompt(message, text.slice(0, 500)),
              maxOutputTokens: 32,
            });
            const title = sanitizeThreadTitle(raw);
            if (title) await saveThreadTitle(threadId, title);
          } catch (titleError) {
            console.error(
              "[chat] título IA falló; se conserva el determinista:",
              titleError instanceof Error ? titleError.name : titleError,
            );
          }
        }
      },
      onError: async (error) => {
        // Una APICallError puede retener el request del proveedor. Con foto no
        // logueamos el objeto ni su mensaje para que el base64 nunca llegue a logs.
        console.error(
          "[chat] stream incompleto:",
          image
            ? error instanceof Error
              ? error.name
              : "Error de IA"
            : error,
        );
        await releaseAssistantTurn(assistantMessageId);
      },
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
