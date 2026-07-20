"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { AddSheet } from "@/components/hoy/add-sheet";
import { CheckinCierre, CheckinMatinal, WeightExpressSheet } from "@/components/hoy/checkins";
import { CoachWelcome } from "@/components/hoy/coach-card";
import { CoachSheet } from "@/components/hoy/coach-sheet";
import { CompeticionRefuel } from "@/components/hoy/competicion-refuel";
import { DayStatusLine } from "@/components/hoy/day-status-line";
import {
  BaselineBlock,
  ContextoRelojBlock,
  EntrenamientoBlock,
  HinchazonAguaSection,
} from "@/components/hoy/hoy-extras";
import { MealTimeline } from "@/components/hoy/meal-timeline";
import { MiDiaSheet } from "@/components/hoy/mi-dia-card";
import { useToday } from "@/components/hoy/use-today";
import { FuelGauge } from "@/components/fuel-gauge/fuel-gauge";
import { dayKey, labelForKey } from "@/lib/dates";
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
  const [miDiaOpen, setMiDiaOpen] = useState(false);
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

  return (
    // El botón fijo «+ Añadir comida» flota sobre la nav (~safe-area+116px de alto
    // total desde abajo). `main` ya aporta pb-24 (96px) para la nav; aquí solo se
    // suma lo justo para que «Mi día» no quede tapada al hacer scroll, sin dejar
    // un hueco enorme.
    <div
      className="space-y-3"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 44px)" }}
    >
      {/* Fecha navegable + racha viven ahora en el topbar (AppTopbar, variante Hoy). */}
      <CoachWelcome coach={data.coach} onOpen={() => setCoachOpen(true)} />

      <FuelGauge
        targets={data.targets}
        entries={data.view.entries}
        phase={phase}
        dateLabel={labelForKey(date).replace(/^\S+\s/, "")}
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
        templates={data.templates}
        onAddToMeal={openAdd}
        onSaveEntry={(id, patch) => t.updateEntry(id, patch)}
        onDeleteEntry={t.deleteEntry}
        onCopyYesterday={t.copyYesterday}
        onSaveTemplate={t.saveTemplate}
        onApplyTemplate={t.applyTemplate}
        onDeleteTemplate={t.deleteTemplate}
      />

      <HinchazonAguaSection
        view={data.view}
        onPatch={t.patchDay}
        onRevisar={() => setMatinalOpen(true)}
        onOpenDayContext={() => setMiDiaOpen(true)}
      />

      <EntrenamientoBlock view={data.view} defaultSession={data.defaultSession} />

      <BaselineBlock baseline={data.baseline} />

      <ContextoRelojBlock intakeKcal={totals.kcal} view={data.view} />

      {/* FAB «+ Añadir comida» (flotante abajo-derecha, sobre la nav). Alineado al
          borde de la columna (max-w 560) en escritorio; a 1rem en móvil. */}
      <button
        type="button"
        onClick={() => openAdd(mealByHour())}
        aria-label="Añadir comida"
        className="fixed z-10 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_22px_color-mix(in_srgb,var(--primary)_35%,transparent)]"
        style={{
          bottom: "calc(env(safe-area-inset-bottom) + 76px)",
          right: "max(1rem, calc(50vw - 280px + 1rem))",
        }}
      >
        <Plus className="size-6" aria-hidden />
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
      <MiDiaSheet
        open={miDiaOpen}
        onOpenChange={setMiDiaOpen}
        view={data.view}
        onPatch={t.patchDay}
        trainingSessions={data.trainingSessions}
        suggestedPhase={data.suggestedPhase}
        onCheckinMatinal={() => setMatinalOpen(true)}
        onPesoExpres={() => setWeightOpen(true)}
        onCierre={() => setCierreOpen(true)}
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
