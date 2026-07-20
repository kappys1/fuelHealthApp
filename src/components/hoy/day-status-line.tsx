"use client";

import { ChevronRight, Moon, Scale, UtensilsCrossed } from "lucide-react";
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
  let Icon = Scale;

  if (hour < 12 && !hasWeight) {
    msg = "Falta el peso de hoy";
    action = onWeight;
    Icon = Scale;
  } else if (hour >= 12 && hour < 21 && !hasComida) {
    msg = "Sin registro de la comida";
    action = onAddMeal;
    Icon = UtensilsCrossed;
  } else if (hour >= 21 && !dayClosed) {
    msg = "Cierra el día: ¿hinchazón y notas?";
    action = onClose;
    Icon = Moon;
  }

  // Sin acción pendiente → nada (el coach-welcome de arriba ya saluda). La línea de
  // estado es SOLO la acción contextual pendiente (09 §3), como en la v1.
  if (!msg || !action) return null;

  return (
    <button
      type="button"
      onClick={action}
      className="flex w-full items-center gap-3 rounded-[14px] border border-primary/30 bg-primary/5 px-3.5 py-2.5 text-left"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-[13px] font-medium text-primary">{msg}</span>
      <ChevronRight className="size-4 shrink-0 text-primary" aria-hidden />
    </button>
  );
}
