import { PlanScreen } from "@/components/plan/plan-screen";
import { dayKey } from "@/lib/dates";
import { getPlanContext } from "@/server/db/queries/plan";
import { getTrainingWeekView } from "@/server/db/queries/training";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const today = dayKey();
  const [ctx, week] = await Promise.all([
    getPlanContext(today),
    getTrainingWeekView(today),
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
    />
  );
}
