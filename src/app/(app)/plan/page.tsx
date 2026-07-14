import { PlanScreen } from "@/components/plan/plan-screen";
import { dayKey } from "@/lib/dates";
import { listMarksWithEntries } from "@/server/db/queries/marks";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrainingWeekView } from "@/server/db/queries/training";

export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const today = dayKey();
  const { tab } = await searchParams;
  const initialSegment = tab === "entrenos" ? "entrenos" : "dieta";
  const [ctx, week, marks] = await Promise.all([
    getPlanContext(today),
    getTrainingWeekView(today),
    listMarksWithEntries(),
  ]);

  if (!ctx) {
    return (
      <div className="rounded-xl border border-dashed border-line bg-surface-2 p-6">
        <p className="text-sm text-foreground">
          No hay ninguna versión de dieta. Ejecuta el seed (`pnpm db:seed`) o la
          migración del PoC.
        </p>
      </div>
    );
  }

  return (
    <PlanScreen
      targets={ctx.targets}
      derived={ctx.derived}
      optionsByMeal={ctx.optionsByMeal}
      week={week}
      marks={marks}
      today={today}
      initialSegment={initialSegment}
    />
  );
}
