"use client";

import { ChevronRight } from "lucide-react";
import type { TodayPayload } from "@/server/db/queries/today";

/** Hora actual (0-23) en Europe/Madrid. */
function madridHour(): number {
  const h = new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  return Number(h);
}

/**
 * Estado del día guiado (07 §1): UNA sola acción contextual por hora. Solo se
 * muestra viendo HOY; desaparece cuando el día está al día.
 */
export function DayStatusLine({
  data,
  isToday,
  onWeight,
  onAddMeal,
  onClose,
}: {
  data: TodayPayload;
  isToday: boolean;
  onWeight: () => void;
  onAddMeal: () => void;
  onClose: () => void;
}) {
  if (!isToday) return null;

  const hour = madridHour();
  const day = data.view.day;
  // Peso de hoy = manual O báscula (Apple Health). Si la báscula ya sincronizó
  // el peso, el día está cubierto (principio 6: datos reales > manuales) y no se
  // pide. Debe coincidir con el peso EFECTIVO que muestra «Mi día» (mi-dia-card).
  const hasWeight = day?.weight != null || data.view.health?.weight != null;
  const hasComida = data.view.entries.some((e) => e.meal === "comida");
  const dayClosed = day?.notes != null && day?.bloat != null;

  let msg: string | null = null;
  let action: (() => void) | null = null;

  if (hour < 12 && !hasWeight) {
    msg = "Falta el peso de hoy";
    action = onWeight;
  } else if (hour >= 12 && hour < 21 && !hasComida) {
    msg = "Sin registro de la comida";
    action = onAddMeal;
  } else if (hour >= 21 && !dayClosed) {
    msg = "Cierra el día: ¿hinchazón y notas?";
    action = onClose;
  }

  if (!msg || !action) return null;

  return (
    <button
      type="button"
      onClick={action}
      className="flex min-h-11 w-full items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5 text-left"
    >
      <span className="text-[13px] font-medium text-primary">{msg}</span>
      <ChevronRight className="size-4 text-primary" aria-hidden />
    </button>
  );
}
