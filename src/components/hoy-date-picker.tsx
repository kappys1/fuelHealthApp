"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { dayKey, labelForKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];

/** Date (mediodía, para evitar bordes DST/medianoche) a partir de una clave de día. */
function parseKey(key: string): Date {
  return new Date(`${key}T12:00:00`);
}

/*
  Selector de día del topbar de Hoy (Restyle v2, mockup image #3): al tocar la fecha
  se abre un calendario mensual para saltar a cualquier día. Los días futuros se
  deshabilitan (no se registra un día que no ha pasado). Navega vía router a
  /hoy?date=YYYY-MM-DD (Europe/Madrid, `dayKey`).
*/
export function HeaderDatePicker({ date }: { date: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => startOfMonth(parseKey(date)));

  const today = dayKey();
  const isToday = date === today;
  const short = labelForKey(date).replace(/^\S+\s/, "");

  const gridStart = startOfWeek(startOfMonth(view), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(view), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const select = (k: string) => {
    setOpen(false);
    router.push(k === today ? "/hoy" : `/hoy?date=${k}`);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) setView(startOfMonth(parseKey(date)));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className="min-w-0 truncate text-[13px] font-semibold text-foreground"
        >
          {isToday ? `Hoy · ${short}` : labelForKey(date)}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" className="w-[300px] p-3">
        <div className="flex items-center justify-between">
          <span
            className="text-[14px] font-semibold capitalize text-foreground"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {format(view, "LLLL yyyy", { locale: es })}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              aria-label="Mes anterior"
              onClick={() => setView((v) => addMonths(v, -1))}
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronUp className="size-4" aria-hidden />
            </button>
            <button
              type="button"
              aria-label="Mes siguiente"
              onClick={() => setView((v) => addMonths(v, 1))}
              className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-y-1 text-center">
          {WEEKDAYS.map((d) => (
            <span key={d} className="text-[11px] font-semibold text-muted-foreground">
              {d}
            </span>
          ))}
          {days.map((d) => {
            const k = dayKey(d);
            const inMonth = isSameMonth(d, view);
            const isSel = k === date;
            const isTod = k === today;
            const future = k > today;
            return (
              <button
                key={k}
                type="button"
                disabled={future}
                onClick={() => select(k)}
                aria-current={isTod ? "date" : undefined}
                className={cn(
                  "num mx-auto grid size-9 place-items-center rounded-full text-[13px]",
                  isSel
                    ? "bg-primary font-semibold text-primary-foreground"
                    : isTod
                      ? "border border-primary text-foreground"
                      : inMonth
                        ? "text-foreground hover:bg-surface-2"
                        : "text-muted-foreground/50",
                  future && "opacity-30",
                )}
              >
                {format(d, "d")}
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-[13px] text-muted-foreground hover:text-foreground"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => select(today)}
            className="text-[13px] font-semibold text-primary"
          >
            Hoy
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
