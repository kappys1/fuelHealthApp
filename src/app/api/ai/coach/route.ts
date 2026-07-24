import { z } from "zod";
import { ensureAuth, parseBody, serverError } from "@/lib/api";
import { dayKey, isoWeekday, shiftDayKey } from "@/lib/dates";
import { MEAL_ORDER, phaseLabel } from "@/lib/macros";
import { retry } from "@/lib/retry";
import { dateZ } from "@/lib/schemas";
import { getAthleteContexts } from "@/server/ai/athlete";
import { runText } from "@/server/ai/client";
import {
  dayContext,
  energyBalanceLine,
  gaugeVerdictLine,
  pendingPlanOptions,
  trendJudgeLine,
} from "@/server/ai/context";
import { aiErrorResponse } from "@/server/ai/errors";
import { coachPrompt } from "@/server/ai/prompts";
import { dayTotals } from "@/server/analytics/dayTotals";
import { computeDeficit } from "@/server/analytics/deficit";
import { energyBalance } from "@/server/analytics/energyBalance";
import { gaugeVerdict } from "@/server/analytics/gaugeVerdict";
import { getDayView } from "@/server/db/queries/day";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrendData } from "@/server/db/queries/trend";
import {
  coachContextHash,
  type CoachReading,
} from "@/server/ai/coach-reading";
import { saveCoachReading } from "@/server/db/queries/coach-reading";

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
  let trend: Awaited<ReturnType<typeof getTrendData>>;
  try {
    [view, plan, atleta, trend] = await Promise.all([
      retry(() => getDayView(targetDate)),
      retry(() => getPlanContext(targetDate)),
      retry(() => getAthleteContexts(targetDate)),
      retry(() => getTrendData(base)),
    ]);
  } catch (err) {
    return serverError(err);
  }

  const targets = plan?.targets ?? { kcal: 0, prot: 0, carb: 0, fat: 0 };

  // Veredicto + balance + déficit real JUZGADOS EN SERVIDOR (principio 1): el
  // modelo NO recalcula, recibe el mismo juicio determinista que el FuelGauge
  // más el gasto del reloj y el juez real (báscula). El prompt solo pone el tono.
  const totals = dayTotals(view.entries);
  const verdict = gaugeVerdict(targets, totals, view.day?.phase ?? null);
  const sesionCalendario =
    atleta.sessionByWeekday[String(isoWeekday(targetDate))] ?? "Descanso";
  const sessionLabel = view.day?.sessionLabel
    ? `día de entreno: ${view.day.sessionLabel}`
    : view.session
      ? `día de entreno: ${view.session.nombre}`
      : sesionCalendario.toLowerCase().includes("descanso")
        ? "descanso"
        : `día de entreno según calendario: ${sesionCalendario}`;
  const dataLines = plan
    ? [
        gaugeVerdictLine(verdict, {
          faseLabel: phaseLabel(view.day?.phase ?? null),
          sessionLabel,
        }),
      ]
    : ["Sin pauta nutricional configurada: no evaluar kcal ni macros contra un objetivo."];
  // Balance ingesta−gasto y déficit real solo en modo "ayer" (día cerrado): a
  // mitad de un día en curso el gasto aún no está completo → sería engañoso.
  if (parsed.data.mode === "ayer") {
    const balanceLine = energyBalanceLine(
      energyBalance({
        intakeKcal: totals.kcal,
        basalKcal: view.health?.basalKcal ?? null,
        activeKcal: view.health?.activeKcal ?? null,
        sessionKcal: view.day?.sessionKcal ?? null,
      }),
    );
    if (balanceLine) dataLines.push(balanceLine);
    dataLines.push(trendJudgeLine(computeDeficit(trend.records)));
  }
  const dayData = dataLines.join("\n");

  // Comidas del plan que aún le quedan (F01 Fase 1): en curso = las sin entrada
  // registrada; día terminado = todas (las sugerencias del coach son "para hoy").
  const loggedMeals = new Set(view.entries.map((e) => e.meal));
  const pendingMeals = MEAL_ORDER.filter(
    (m) => m !== "extra" && (parsed.data.mode === "ayer" || !loggedMeals.has(m)),
  );
  const planPendiente = plan
    ? pendingPlanOptions(plan.optionsByMeal, pendingMeals)
    : "";

  let text: string;
  try {
    text = await runText({
      kind: "coach",
      task: "coach",
      prompt: coachPrompt({
        atleta: atleta.full,
        today: base,
        targetDate,
        mode: parsed.data.mode,
        kcal: plan?.targets.kcal ?? null,
        prot: plan?.targets.prot ?? null,
        carb: plan?.targets.carb ?? null,
        fat: plan?.targets.fat ?? null,
        dayContext: dayContext(view, {
          sessionByWeekday: atleta.sessionByWeekday,
          date: targetDate,
        }),
        planPendiente,
        dayData,
      }),
      // 100 palabras + thinking "medium": presupuesto amplio para no truncar.
      maxOutputTokens: 3072,
    });
  } catch (err) {
    return aiErrorResponse(err);
  }

  const reading: CoachReading = {
    baseDate: base,
    targetDate,
    mode: parsed.data.mode,
    text,
    generatedAt: new Date().toISOString(),
    contextHash: coachContextHash(view, targets),
  };
  try {
    await saveCoachReading(reading);
    return Response.json(reading);
  } catch (err) {
    return serverError(err);
  }
}
