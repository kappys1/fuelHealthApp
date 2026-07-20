"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flame, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client-api";
import { dayKey, labelForKey, shiftDayKey } from "@/lib/dates";

/*
  Topbar compartido (Restyle v2 · chrome global, estructura real del mockup).
  - En Hoy: badge «F» + navegación de día (‹ Hoy · 17 jul ›) + racha 🔥 + Ajustes.
    La fecha sale de ?date; la racha, de la query compartida ['today', date] (misma
    caché que la pantalla, sin fetch extra dentro del staleTime).
  - En el resto: badge «F» + eyebrow FUELBOARD + subtítulo por ruta + Ajustes.
  El H1 grande de cada pantalla lo pone la propia pantalla.
*/
const SUBTITLE: Record<string, string> = {
  "/plan": "Tu plan actual",
  "/progreso": "Progreso",
  "/chat": "Pregúntale a tus datos",
  "/ajustes": "Ajustes",
};

export function AppTopbar() {
  const pathname = usePathname();
  const isHoy = pathname.startsWith("/hoy");

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-background/90 px-4 pb-2.5 backdrop-blur"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <Link href="/hoy" aria-label="Fuelboard" className="shrink-0">
        <span
          className="grid size-8 place-items-center rounded-[9px] bg-ink text-[19px] leading-none font-bold text-bg"
          style={{ fontFamily: "var(--font-display)" }}
          aria-hidden
        >
          F
        </span>
      </Link>

      {isHoy ? <HoyNav /> : <ScreenTitle pathname={pathname} />}

      <Link
        href="/ajustes"
        aria-label="Ajustes"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <Settings className="size-[18px]" aria-hidden />
      </Link>
    </header>
  );
}

function ScreenTitle({ pathname }: { pathname: string }) {
  const key = Object.keys(SUBTITLE).find((k) => pathname.startsWith(k));
  const subtitle = key ? SUBTITLE[key] : "Tu día";
  return (
    <div className="min-w-0 flex-1">
      <span className="block text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
        Fuelboard
      </span>
      <span className="block truncate text-[13px] font-semibold text-foreground">
        {subtitle}
      </span>
    </div>
  );
}

function HoyNav() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? dayKey();
  const isToday = date === dayKey();

  // Racha desde la caché compartida de la pantalla (no fuerza fetch dentro del staleTime).
  const { data } = useQuery({
    queryKey: ["today", date],
    queryFn: () => api.getDay(date),
    staleTime: 15_000,
  });
  const streak = data?.streak ?? 0;

  const short = labelForKey(date).replace(/^\S+\s/, "");
  const go = (delta: number) =>
    router.push(`/hoy?date=${shiftDayKey(date, delta)}`);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-1">
      <button
        type="button"
        aria-label="Día anterior"
        onClick={() => go(-1)}
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => router.push("/hoy")}
        className="min-w-0 truncate text-[13px] font-semibold text-foreground"
      >
        {isToday ? `Hoy · ${short}` : labelForKey(date)}
      </button>
      <button
        type="button"
        aria-label="Día siguiente"
        onClick={() => go(1)}
        disabled={isToday}
        className="inline-flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[12px] text-muted-foreground">
        <Flame className="size-3.5 text-primary" aria-hidden />
        <span className="num">{streak}</span>
      </span>
    </div>
  );
}
