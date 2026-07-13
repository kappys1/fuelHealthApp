import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey, shiftDayKey } from "@/lib/dates";
import { MEAL_ORDER } from "@/lib/macros";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runText } from "@/server/ai/client";
import { dayContext, pendingPlanOptions } from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { coachPrompt } from "@/server/ai/prompts";
import { getDayView } from "@/server/db/queries/day";
import { getPlanContext } from "@/server/db/queries/plan";

const bodyZ = z.object({
  date: dateZ.optional(),
  mode: z.enum(["hoy", "ayer"]),
});

/*
  F-IA-6 · Coach diario (tras el ✨ del FuelGauge). Modo "hoy" = día en curso;
  "ayer" = fecha−1. Contexto completo del día (comidas, totales, peso, sesión,
  fase, agua, hinchazón, NOTAS, métricas del reloj). Texto plano, máx 100 palabras.
*/
export async function POST(request: Request) {
  const unauth = await ensureAuth();
  if (unauth) return unauth;

  const parsed = await parseBody(request, bodyZ);
  if ("error" in parsed) return parsed.error;

  const base = parsed.data.date ?? dayKey();
  const targetDate = parsed.data.mode === "ayer" ? shiftDayKey(base, -1) : base;

  let view: Awaited<ReturnType<typeof getDayView>>;
  let plan: Awaited<ReturnType<typeof getPlanContext>>;
  let atleta: Awaited<ReturnType<typeof getAthleteContexts>>;
  try {
    [view, plan, atleta] = await Promise.all([
      retry(() => getDayView(targetDate)),
      retry(() => getPlanContext(targetDate)),
      retry(() => getAthleteContexts(targetDate)),
    ]);
  } catch (err) {
    return serverError(err);
  }

  const targets = plan?.targets ?? { kcal: 1800, prot: 110, carb: 0, fat: 0 };

  // Comidas del plan que aún le quedan (F01 Fase 1): en curso = las sin entrada
  // registrada; día terminado = todas (las sugerencias del coach son "para hoy").
  const loggedMeals = new Set(view.entries.map((e) => e.meal));
  const pendingMeals = MEAL_ORDER.filter(
    (m) => m !== "extra" && (parsed.data.mode === "ayer" || !loggedMeals.has(m)),
  );
  const planPendiente = plan
    ? pendingPlanOptions(plan.optionsByMeal, pendingMeals)
    : "";

  try {
    const text = await runText({
      kind: "coach",
      task: "coach",
      prompt: coachPrompt({
        atleta: atleta.full,
        today: base,
        targetDate,
        mode: parsed.data.mode,
        kcal: targets.kcal,
        prot: targets.prot,
        carb: targets.carb,
        fat: targets.fat,
        dayContext: dayContext(view, {
          sessionByWeekday: atleta.sessionByWeekday,
          date: targetDate,
        }),
        planPendiente,
      }),
      // 100 palabras + thinking "medium": presupuesto amplio para no truncar.
      maxOutputTokens: 3072,
    });
    return Response.json({ text });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
