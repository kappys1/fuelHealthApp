import { redirect } from "next/navigation";
import { PlanScreen } from "@/components/plan/plan-screen";
import { dayKey, isDayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { trainingWeekSpan } from "@/lib/training";
import { listMarksWithEntries } from "@/server/db/queries/marks";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrainingWeekView } from "@/server/db/queries/training";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string }>;
}) {
  const today = dayKey();
  const { tab, week: weekParam } = await searchParams;
  const initialSegment = tab === "entrenos" ? "entrenos" : "dieta";
  const requestedWeek = trainingWeekSpan(
    weekParam && isDayKey(weekParam) ? weekParam : today,
  ).validFrom;
  const currentWeek = trainingWeekSpan(today).validFrom;
  const selectedWeek = requestedWeek > currentWeek ? currentWeek : requestedWeek;
  if (initialSegment === "entrenos" && weekParam !== selectedWeek) {
    redirect(`/plan?tab=entrenos&week=${selectedWeek}`);
  }
  const [ctx, week, marks] = await retry(() =>
    Promise.all([
      getPlanContext(today),
      getTrainingWeekView(selectedWeek),
      listMarksWithEntries(),
    ]),
  );

  return (
    <PlanScreen
      targets={ctx?.targets ?? null}
      derived={ctx?.derived ?? null}
      optionsByMeal={ctx?.optionsByMeal ?? {}}
      effectiveFrom={ctx?.version.effectiveFrom ?? null}
      versionId={ctx?.version.id ?? null}
      week={week}
      marks={marks}
      today={today}
      selectedWeek={selectedWeek}
      initialSegment={initialSegment}
    />
  );
}
