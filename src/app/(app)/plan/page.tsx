import { redirect } from "next/navigation";
import { PlanScreen } from "@/components/plan/plan-screen";
import { dayKey, isDayKey } from "@/lib/dates";
import { retry } from "@/lib/retry";
import { trainingWeekNavigation } from "@/lib/training";
import { listMarksWithEntries } from "@/server/db/queries/marks";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrainingWeekView } from "@/server/db/queries/training";
import { getTrainingByWeekday, listProducts } from "@/server/db/queries/lookups";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; week?: string }>;
}) {
  const today = dayKey();
  const { tab, week: weekParam } = await searchParams;
  const initialSegment = tab === "entrenos" ? "entrenos" : "dieta";
  const { selectedWeek } = trainingWeekNavigation(
    weekParam && isDayKey(weekParam) ? weekParam : today,
    today,
  );
  if (initialSegment === "entrenos" && weekParam !== selectedWeek) {
    redirect(`/plan?tab=entrenos&week=${selectedWeek}`);
  }
  const [ctx, week, marks, trainingByWeekday, products] = await retry(() =>
    Promise.all([
      getPlanContext(today),
      getTrainingWeekView(selectedWeek),
      listMarksWithEntries(),
      getTrainingByWeekday(),
      listProducts(),
    ]),
  );

  return (
    <PlanScreen
      targets={ctx?.targets ?? null}
      derived={ctx?.derived ?? null}
      optionsByMeal={ctx?.optionsByMeal ?? {}}
      products={products}
      effectiveFrom={ctx?.version.effectiveFrom ?? null}
      versionId={ctx?.version.id ?? null}
      week={week}
      marks={marks}
      today={today}
      selectedWeek={selectedWeek}
      initialSegment={initialSegment}
      trainingByWeekday={trainingByWeekday}
    />
  );
}
