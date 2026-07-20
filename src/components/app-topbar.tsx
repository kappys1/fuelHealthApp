"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { HeaderDatePicker } from "@/components/hoy-date-picker";
import { ThemeToggle } from "@/components/theme-toggle";
import { api } from "@/lib/client-api";
import { dayKey, shiftDayKey } from "@/lib/dates";

/*
  Topbar compartido (Restyle v2 · chrome global, estructura real del mockup image #3).
  Izquierda: badge «F». Centro: eyebrow FUELBOARD + (en Hoy) navegación de día con
  calendario + racha 🔥; en el resto, subtítulo por ruta. Derecha: toggle de tema +
  avatar (→ perfil/Ajustes). El H1 grande de cada pantalla lo pone la propia pantalla.
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
      className="sticky top-0 z-30 flex items-center gap-3 border-b border-line bg-background/90 px-4 pb-2.5 backdrop-blur"
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

      <div className="min-w-0 flex-1">
        <span className="block text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
          Fuelboard
        </span>
        {isHoy ? <HoyNav /> : <ScreenSubtitle pathname={pathname} />}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle compact />
        <Link
          href="/ajustes"
          aria-label="Perfil y ajustes"
          className="grid size-9 place-items-center rounded-full bg-primary text-[14px] font-bold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          A
        </Link>
      </div>
    </header>
  );
}

function ScreenSubtitle({ pathname }: { pathname: string }) {
  const key = Object.keys(SUBTITLE).find((k) => pathname.startsWith(k));
  return (
    <span className="block truncate text-[13px] font-semibold text-foreground">
      {key ? SUBTITLE[key] : "Tu día"}
    </span>
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

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label="Día anterior"
        onClick={() => router.push(`/hoy?date=${shiftDayKey(date, -1)}`)}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>
      <HeaderDatePicker date={date} />
      <button
        type="button"
        aria-label="Día siguiente"
        onClick={() => router.push(`/hoy?date=${shiftDayKey(date, 1)}`)}
        disabled={isToday}
        className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground disabled:opacity-40"
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
      <span className="ml-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground">
        <Flame className="size-3.5 text-primary" aria-hidden />
        <span className="num">{streak}</span> días
      </span>
    </div>
  );
}
