"use client";

import { ChevronLeft, ChevronRight, Flame, Plus } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FuelGauge } from "@/components/fuel-gauge/fuel-gauge";
import { AddSheet } from "@/components/hoy/add-sheet";
import { CheckinCierre, CheckinMatinal, WeightExpressSheet } from "@/components/hoy/checkins";
import { CoachGreetingCard } from "@/components/hoy/coach-greeting-card";
import { CoachSheet } from "@/components/hoy/coach-sheet";
import { CompeticionRefuel } from "@/components/hoy/competicion-refuel";
import { DayStatusLine } from "@/components/hoy/day-status-line";
import { MealTimeline } from "@/components/hoy/meal-timeline";
import { OfflineQueueStatus } from "@/components/hoy/offline-queue-status";
import {
  BaselineSection,
  BloatEventSheet,
  DailyChecks,
  TrainingSection,
  WatchContextSection,
} from "@/components/hoy/today-context";
import { useToday } from "@/components/hoy/use-today";
import { dayKey, labelForKey, shiftDayKey } from "@/lib/dates";
import type { BloatKey, MealKey } from "@/lib/macros";
import { roundKcal } from "@/lib/macros";
import { dayTotals } from "@/server/analytics/dayTotals";
import type { BloatEventDTO } from "@/server/db/queries/bloat";
import type { TodayPayload } from "@/server/db/queries/today";

const MADRID_TIME_FORMATTER = new Intl.DateTimeFormat("es-ES", {
  timeZone: "Europe/Madrid",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function mealByHour(): MealKey {
  const hour = Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date()),
  );
  if (hour < 11) return "almuerzo";
  if (hour < 16) return "comida";
  if (hour < 20) return "merienda";
  return "cena";
}

function currentMadridTime(): string {
  return MADRID_TIME_FORMATTER.format(new Date());
}

type BloatEditor =
  | { event: BloatEventDTO; severity: BloatKey }
  | { event: null; severity: BloatKey };

export function HoyClient({
  date,
  initial,
}: {
  date: string;
  initial: TodayPayload;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayState = useToday(date, initial);
  const data = todayState.data;
  const today = dayKey();
  const isToday = date === today;
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  const [addMeal, setAddMeal] = useState<MealKey>(() =>
    searchParams.get("add") === "1" ? mealByHour() : "comida",
  );
  const [matinalOpen, setMatinalOpen] = useState(false);
  const [cierreOpen, setCierreOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(
    () => isToday && searchParams.get("checkin") === "weight",
  );
  const [coachOpen, setCoachOpen] = useState(false);
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const [bloatEditor, setBloatEditor] = useState<BloatEditor | null>(null);

  const openAdd = (meal: MealKey) => {
    setAddMeal(meal);
    setAddOpen(true);
  };

  useEffect(() => {
    const add = searchParams.get("add");
    const checkin = searchParams.get("checkin");
    const share = searchParams.get("share");
    if (!add && !checkin && !share) return;

    if (share === "1") {
      void (async () => {
        try {
          const cache = await caches.open("fuelboard-shared");
          const response = await cache.match("/shared-image");
          if (response) {
            const blob = await response.blob();
            await cache.delete("/shared-image");
            setSharedFile(
              new File([blob], "compartida.jpg", {
                type: blob.type || "image/jpeg",
              }),
            );
            setAddMeal(mealByHour());
            setAddOpen(true);
          } else {
            setAddMeal(mealByHour());
            setAddOpen(true);
            toast.error("No se encontró la imagen compartida. Puedes elegirla de nuevo.");
          }
        } catch {
          setAddMeal(mealByHour());
          setAddOpen(true);
          toast.error("No se pudo recuperar la imagen compartida. Puedes elegirla de nuevo.");
        }
      })();
    }
    window.history.replaceState(null, "", isToday ? "/hoy" : `/hoy?date=${date}`);
    // Los shortcuts solo se consumen durante el montaje inicial.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!data || !isToday) return;
    const consumed = roundKcal(dayTotals(data.view.entries).kcal);
    document.title = data.targets.kcal > 0
      ? `${consumed.toLocaleString("es-ES")} / ${data.targets.kcal.toLocaleString("es-ES")} · Fuelboard`
      : `${consumed.toLocaleString("es-ES")} kcal · Fuelboard`;
    return () => {
      document.title = "Fuelboard";
    };
  }, [data, isToday]);

  if (!data) return null;

  const totals = dayTotals(data.view.entries);
  const phase = data.view.day?.phase ?? null;
  const go = (delta: number) => {
    const next = shiftDayKey(date, delta);
    if (next > today) return;
    router.push(next === today ? "/hoy" : `/hoy?date=${next}`);
  };

  const selectBloat = (severity: BloatKey) => {
    const latest = data.bloatEvents.at(-1);
    if (latest) {
      void todayState.updateBloatEvent(latest.id, { severity }).catch(() => undefined);
      return;
    }
    if (isToday) {
      void todayState.createBloatEvent(severity, currentMadridTime()).catch(() => undefined);
      return;
    }
    setBloatEditor({ event: null, severity });
  };

  const saveCurrentBloat = async (severity: BloatKey) => {
    const latest = data.bloatEvents.at(-1);
    if (latest) {
      await todayState.updateBloatEvent(latest.id, { severity });
      return;
    }
    await todayState.createBloatEvent(severity, currentMadridTime());
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center rounded-xl border border-line bg-surface p-0.5 shadow-card">
          <button
            type="button"
            aria-label="Día anterior"
            onClick={() => go(-1)}
            className="grid size-11 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-surface-2"
          >
            <ChevronLeft className="size-4" aria-hidden />
          </button>
          <label className="relative grid min-h-11 min-w-0 flex-1 cursor-pointer place-items-center px-1.5">
            <span className="truncate text-center text-[12px] font-semibold text-foreground">
              {isToday ? `Hoy · ${labelForKey(date).replace(/^\S+\s/, "")}` : labelForKey(date)}
            </span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(event) => {
                const next = event.target.value;
                if (!next || next > today) return;
                router.push(next === today ? "/hoy" : `/hoy?date=${next}`);
              }}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-label="Ir a una fecha"
            />
          </label>
          <button
            type="button"
            aria-label="Día siguiente"
            onClick={() => go(1)}
            disabled={date >= today}
            className="grid size-11 shrink-0 place-items-center rounded-[10px] text-muted-foreground hover:bg-surface-2 disabled:opacity-35"
          >
            <ChevronRight className="size-4" aria-hidden />
          </button>
        </div>
        <span
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-surface px-3 font-display text-[12px] font-semibold tabular-nums text-foreground shadow-card"
          aria-label={`Racha de ${data.streak} días`}
        >
          {data.streak} días <Flame className="size-4 text-fat" aria-hidden />
        </span>
      </div>

      <CoachGreetingCard
        reading={data.coachReading}
        onOpen={() => setCoachOpen(true)}
        onRefresh={todayState.refreshCoach}
      />

      <OfflineQueueStatus />

      <DayStatusLine
        data={data}
        isToday={isToday}
        onWeight={() => setMatinalOpen(true)}
        onAddMeal={() => openAdd(mealByHour())}
        onClose={() => setCierreOpen(true)}
      />

      <FuelGauge targets={data.targets} entries={data.view.entries} phase={phase} />

      {phase === "competicion" ? (
        <CompeticionRefuel meal={mealByHour()} onAdd={todayState.addEntries} />
      ) : null}

      <MealTimeline
        entries={data.view.entries}
        templates={data.templates}
        onSaveEntry={(id, patch) => todayState.updateEntry(id, patch)}
        onDeleteEntry={todayState.deleteEntry}
        onCopyYesterday={todayState.copyYesterday}
        onSaveTemplate={todayState.saveTemplate}
        onApplyTemplate={todayState.applyTemplate}
        onDeleteTemplate={todayState.deleteTemplate}
      />

      <DailyChecks
        view={data.view}
        isToday={isToday}
        bloatEvents={data.bloatEvents}
        onPatch={todayState.patchDay}
        onBloat={selectBloat}
        onAddBloat={() =>
          setBloatEditor({
            event: null,
            severity:
              data.bloatEvents.at(-1)?.severity ?? data.view.day?.bloat ?? "leve",
          })
        }
        onReviewCheckin={() => setMatinalOpen(true)}
      />

      <TrainingSection
        view={data.view}
        onPatch={todayState.patchDay}
        trainingSessions={data.trainingSessions}
        suggestedPhase={data.suggestedPhase}
      />

      <BaselineSection baseline={data.baseline} />
      <WatchContextSection view={data.view} healthSync={data.healthSync} />

      <button
        type="button"
        onClick={() => openAdd(mealByHour())}
        className="fixed z-30 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_12px_30px_rgb(21_93_184/35%)] focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        style={{
          right: "max(18px, calc((100vw - 560px) / 2 + 18px))",
          bottom: "calc(env(safe-area-inset-bottom) + var(--nav-h) + 14px)",
        }}
        aria-label="Añadir comida"
        title="Añadir comida"
      >
        <Plus className="size-6" aria-hidden />
      </button>

      <AddSheet
        open={addOpen}
        onOpenChange={(open) => {
          setAddOpen(open);
          if (!open) setSharedFile(null);
        }}
        meal={addMeal}
        setMeal={setAddMeal}
        corpus={{
          optionsByMeal: data.optionsByMeal,
          products: data.products,
          recents: data.recents,
        }}
        products={{
          create: todayState.createProduct,
          update: todayState.updateProduct,
          remove: todayState.deleteProduct,
          togglePin: todayState.toggleProductPin,
        }}
        targetKcal={data.targets.kcal}
        currentKcal={roundKcal(totals.kcal)}
        date={date}
        onAdd={todayState.addEntries}
        initialFile={sharedFile}
      />
      <CheckinMatinal
        key={`matinal-${date}-${matinalOpen ? "open" : "closed"}`}
        open={matinalOpen}
        onOpenChange={setMatinalOpen}
        data={data}
        onPatch={todayState.patchDay}
        onBloat={saveCurrentBloat}
      />
      <CheckinCierre
        key={`cierre-${date}-${cierreOpen ? "open" : "closed"}`}
        open={cierreOpen}
        onOpenChange={setCierreOpen}
        data={data}
        onPatch={todayState.patchDay}
        onAddMeal={() => openAdd(mealByHour())}
      />
      <WeightExpressSheet
        key={`weight-${date}-${weightOpen ? "open" : "closed"}`}
        open={weightOpen}
        onOpenChange={setWeightOpen}
        data={data}
        onPatch={todayState.patchDayNow}
        onBloat={saveCurrentBloat}
      />
      <CoachSheet
        open={coachOpen}
        onOpenChange={setCoachOpen}
        date={date}
        initialReadings={data.coachReadings}
        onReading={todayState.setCoachReading}
      />
      {bloatEditor ? (
        <BloatEventSheet
          key={bloatEditor.event?.id ?? `new-${bloatEditor.severity}`}
          open
          onOpenChange={(open) => {
            if (!open) setBloatEditor(null);
          }}
          event={bloatEditor.event}
          initialSeverity={bloatEditor.severity}
          isToday={isToday}
          onCreate={todayState.createBloatEvent}
          onUpdate={todayState.updateBloatEvent}
          onDelete={todayState.deleteBloatEvent}
        />
      ) : null}
    </div>
  );
}
