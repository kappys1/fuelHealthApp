import { PlanClient } from "@/components/plan/plan-client";
import { dayKey } from "@/lib/dates";
import { getPlanContext } from "@/server/db/queries/plan";

export const dynamic = "force-dynamic";

export default async function PlanPage() {
  const ctx = await getPlanContext(dayKey());

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
    <PlanClient
      targets={ctx.targets}
      derived={ctx.derived}
      optionsByMeal={ctx.optionsByMeal}
    />
  );
}
