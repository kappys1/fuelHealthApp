"use client";

import { ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { AddSheet } from "@/components/hoy/add-sheet";
import { CheckinCierre, CheckinMatinal, WeightExpressSheet } from "@/components/hoy/checkins";
import { CompeticionRefuel } from "@/components/hoy/competicion-refuel";
import { DayStatusLine } from "@/components/hoy/day-status-line";
import { MealTimeline } from "@/components/hoy/meal-timeline";
import { MiDiaCard } from "@/components/hoy/mi-dia-card";
import { useToday } from "@/components/hoy/use-today";
import { FuelGauge } from "@/components/fuel-gauge/fuel-gauge";
import { dayKey, labelForKey, shiftDayKey } from "@/lib/dates";
import type { MealKey } from "@/lib/macros";
import { roundKcal } from "@/lib/macros";
import { dayTotals } from "@/server/analytics/dayTotals";
import type { TodayPayload } from "@/server/db/queries/today";

/** Comida por defecto según la hora (09 §4). */
function mealByHour(): MealKey {
  const h = Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (h < 11) return "almuerzo";
  if (h < 16) return "comida";
  if (h < 20) return "merienda";
  return "cena";
}

export function HoyClient({
  date,
  initial,
}: {
  date: string;
  initial: TodayPayload;
}) {
  const router = useRouter();
  const t = useToday(date, initial);
  const data = t.data;

  const [addOpen, setAddOpen] = useState(false);
  const [addMeal, setAddMeal] = useState<MealKey>("comida");
  const [matinalOpen, setMatinalOpen] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);

  const today = dayKey();
  const isToday = date === today;

  const openAdd = (meal: MealKey) => {
    setAddMeal(meal);
    setAddOpen(true);
  };

  if (!data) return null;

  const totals = dayTotals(data.view.entries);
  const phase = data.view.day?.phase ?? null;

  const go = (delta: number) => router.push(`/hoy?date=${shiftDayKey(date, delta)}`);

  return (
    <div className="space-y-3 pb-4">
      {/* Cabecera: fecha navegable + racha (09 §3) */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => go(-1)}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted-foreground"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => router.push("/hoy")}
            className="min-w-[92px] text-center text-[13px] font-semibold text-foreground"
          >
            {isToday ? "Hoy" : labelForKey(date)}
          </button>
          <button
            type="button"
            aria-label="Día siguiente"
            onClick={() => go(1)}
            disabled={isToday}
            className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted-foreground disabled:opacity-40"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <div className="inline-flex items-center gap-1 text-[13px] text-muted-foreground">
          <Flame className="size-4 text-primary" aria-hidden />
          <span className="num">{data.streak}</span>
        </div>
      </div>

      <FuelGauge
        targets={data.targets}
        entries={data.view.entries}
        phase={phase}
        onCoach={() => toast("El coach ✨ llega en la Fase 4.")}
      />

      <DayStatusLine
        data={data}
        isToday={isToday}
        onWeight={() => setMatinalOpen(true)}
        onAddMeal={() => openAdd(mealByHour())}
        onClose={() => setCierreOpen(true)}
      />

      {phase === "competicion" ? (
        <CompeticionRefuel meal={mealByHour()} onAdd={t.addEntries} />
      ) : null}

      <MealTimeline
        entries={data.view.entries}
        favorites={data.favorites}
        templates={data.templates}
        onAddToMeal={openAdd}
        onSaveEntry={(id, patch) => t.updateEntry(id, patch)}
        onDeleteEntry={t.deleteEntry}
        onToggleFav={(e) =>
          t.toggleFavorite({
            meal: e.meal,
            name: e.name,
            kcal: e.kcal,
            prot: e.prot,
            carb: e.carb,
            fat: e.fat,
          })
        }
        onCopyYesterday={t.copyYesterday}
        onSaveTemplate={t.saveTemplate}
        onApplyTemplate={t.applyTemplate}
        onDeleteTemplate={t.deleteTemplate}
      />

      <MiDiaCard view={data.view} onPatch={t.patchDay} />

      {/* Botón primario fijo «+ Añadir comida» (09 §3) */}
      <button
        type="button"
        onClick={() => openAdd(mealByHour())}
        className="fixed inset-x-0 z-10 mx-auto flex w-[calc(100%-2rem)] max-w-[528px] items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground shadow-lg"
        style={{ bottom: "calc(env(safe-area-inset-bottom) + 68px)" }}
      >
        <Plus className="size-5" aria-hidden /> Añadir comida
      </button>

      {/* Sheets */}
      <AddSheet
        open={addOpen}
        onOpenChange={setAddOpen}
        meal={addMeal}
        setMeal={setAddMeal}
        corpus={{
          optionsByMeal: data.optionsByMeal,
          favorites: data.favorites,
          recents: data.recents,
        }}
        targetKcal={data.targets.kcal}
        currentKcal={roundKcal(totals.kcal)}
        date={date}
        onAdd={t.addEntries}
      />
      <CheckinMatinal
        open={matinalOpen}
        onOpenChange={setMatinalOpen}
        data={data}
        onPatch={t.patchDay}
      />
      <CheckinCierre
        open={cierreOpen}
        onOpenChange={setCierreOpen}
        data={data}
        onPatch={t.patchDay}
        onAddMeal={() => openAdd(mealByHour())}
      />
      <WeightExpressSheet
        open={weightOpen}
        onOpenChange={setWeightOpen}
        data={data}
        onPatch={t.patchDay}
      />
    </div>
  );
}
