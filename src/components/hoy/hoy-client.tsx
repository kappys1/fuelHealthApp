"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddSheet } from "@/components/hoy/add-sheet";
import { CheckinCierre, CheckinMatinal, WeightExpressSheet } from "@/components/hoy/checkins";
import { CoachCard } from "@/components/hoy/coach-card";
import { CoachSheet } from "@/components/hoy/coach-sheet";
import { CompeticionRefuel } from "@/components/hoy/competicion-refuel";
import { DayStatusLine } from "@/components/hoy/day-status-line";
import {
  BaselineSection,
  ContextoRelojSection,
  EntrenamientoLine,
} from "@/components/hoy/hoy-extras";
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useToday(date, initial);
  const data = t.data;

  // Atajos del manifest (?add=1 · ?checkin=weight): se resuelven en el estado
  // inicial (sin setState en efecto → sin renders en cascada).
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const [addMeal, setAddMeal] = useState<MealKey>(() =>
    searchParams.get("add") === "1" ? mealByHour() : "comida",
  );
  const [matinalOpen, setMatinalOpen] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  // Shortcut del manifest «Peso de hoy» → sheet exprés de peso (09 §5b: abre
  // directamente ESTE sheet). La línea de estado matinal abre el check-in de 3
  // pasos (09 §5); ver DECISIONS.md.
  const [weightOpen, setWeightOpen] = useState(
    () => searchParams.get("checkin") === "weight",
  );
  const [coachOpen, setCoachOpen] = useState(false);
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  const today = dayKey();
  const isToday = date === today;

  const openAdd = (meal: MealKey) => {
    setAddMeal(meal);
    setAddOpen(true);
  };

  // Share target (?share=1): recupera la imagen compartida del cache del SW y abre
  // la capa de foto. La escritura de estado va en el callback async (no síncrona en
  // el efecto). Al terminar limpia la URL para no reabrir en un re-render.
  useEffect(() => {
    const add = searchParams.get("add");
    const checkin = searchParams.get("checkin");
    const share = searchParams.get("share");
    if (!add && !checkin && !share) return;

    if (share === "1") {
      void (async () => {
        try {
          const cache = await caches.open("fuelboard-shared");
          const res = await cache.match("/shared-image");
          if (res) {
            const blob = await res.blob();
            await cache.delete("/shared-image");
            setSharedFile(
              new File([blob], "compartida.jpg", {
                type: blob.type || "image/jpeg",
              }),
            );
            setAddMeal(mealByHour());
            setAddOpen(true);
          }
        } catch {
          /* sin cache/soporte: degradar sin romper */
        }
      })();
    }
    window.history.replaceState(null, "", isToday ? "/hoy" : `/hoy?date=${date}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Título de documento dinámico (07 §6): "1.240 / 1.800 · Fuelboard" — visible en
  // el multitarea. Solo para el día de hoy; se restaura al salir de la pestaña.
  useEffect(() => {
    if (!data || !isToday) return;
    const consumed = roundKcal(dayTotals(data.view.entries).kcal);
    document.title = `${consumed.toLocaleString("es-ES")} / ${data.targets.kcal.toLocaleString("es-ES")} · Fuelboard`;
    return () => {
      document.title = "Fuelboard";
    };
  }, [data, isToday]);

  if (!data) return null;

  const totals = dayTotals(data.view.entries);
  const phase = data.view.day?.phase ?? null;

  const go = (delta: number) => router.push(`/hoy?date=${shiftDayKey(date, delta)}`);

  return (
    // El botón fijo «+ Añadir comida» flota sobre la nav (~safe-area+116px de alto
    // total desde abajo). `main` ya aporta pb-24 (96px) para la nav; aquí solo se
    // suma lo justo para que «Mi día» no quede tapada al hacer scroll, sin dejar
    // un hueco enorme.
    <div
      className="space-y-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 44px)" }}
    >
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

      <DayStatusLine
        data={data}
        isToday={isToday}
        onWeight={() => setMatinalOpen(true)}
        onAddMeal={() => openAdd(mealByHour())}
        onClose={() => setCierreOpen(true)}
      />

      <FuelGauge
        targets={data.targets}
        entries={data.view.entries}
        phase={phase}
      />

      <CoachCard coach={data.coach} onOpen={() => setCoachOpen(true)} />

      {phase === "competicion" ? (
        <CompeticionRefuel meal={mealByHour()} onAdd={t.addEntries} />
      ) : null}

      <MealTimeline
        entries={data.view.entries}
        templates={data.templates}
        onAddToMeal={openAdd}
        onSaveEntry={(id, patch) => t.updateEntry(id, patch)}
        onDeleteEntry={t.deleteEntry}
        onCopyYesterday={t.copyYesterday}
        onSaveTemplate={t.saveTemplate}
        onApplyTemplate={t.applyTemplate}
        onDeleteTemplate={t.deleteTemplate}
      />

      <EntrenamientoLine view={data.view} defaultSession={data.defaultSession} />

      <BaselineSection baseline={data.baseline} />

      <ContextoRelojSection intakeKcal={totals.kcal} view={data.view} />

      <MiDiaCard
        view={data.view}
        onPatch={t.patchDay}
        trainingSessions={data.trainingSessions}
        suggestedPhase={data.suggestedPhase}
      />

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
        onOpenChange={(v) => {
          setAddOpen(v);
          if (!v) setSharedFile(null);
        }}
        meal={addMeal}
        setMeal={setAddMeal}
        corpus={{
          optionsByMeal: data.optionsByMeal,
          products: data.products,
          recents: data.recents,
        }}
        products={{
          create: t.createProduct,
          update: t.updateProduct,
          remove: t.deleteProduct,
          togglePin: t.toggleProductPin,
        }}
        targetKcal={data.targets.kcal}
        currentKcal={roundKcal(totals.kcal)}
        date={date}
        onAdd={t.addEntries}
        initialFile={sharedFile}
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
      <CoachSheet
        open={coachOpen}
        onOpenChange={(v) => {
          setCoachOpen(v);
          // Al cerrar, refresca el payload para que la tarjeta Coach muestre el
          // análisis recién cacheado (texto + «hace X» actualizados).
          if (!v) void queryClient.invalidateQueries({ queryKey: ["today", date] });
        }}
        date={date}
      />
    </div>
  );
}
