"use client";

import { Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/*
  Topbar compartido (Restyle v2 · chrome global). Badge cuadrado «F» + eyebrow
  FUELBOARD + subtítulo contextual por pantalla + icono de Ajustes (09 §2: Ajustes
  vive en el header, no es pestaña). El H1 grande de cada pantalla lo pone la propia
  pantalla (hero-head en Hoy; PageHeader en las demás).
*/
const SUBTITLE: Record<string, string> = {
  "/hoy": "Tu día",
  "/plan": "Tu plan actual",
  "/progreso": "Progreso",
  "/chat": "Pregúntale a tus datos",
  "/ajustes": "Ajustes",
};

export function AppTopbar() {
  const pathname = usePathname();
  const key = Object.keys(SUBTITLE).find((k) => pathname.startsWith(k));
  const subtitle = key ? SUBTITLE[key] : "Tu día";

  return (
    <header
      className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-background/90 px-4 pb-2.5 backdrop-blur"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.625rem)" }}
    >
      <Link href="/hoy" className="flex min-w-0 items-center gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-ink text-[19px] leading-none font-bold text-bg"
          style={{ fontFamily: "var(--font-display)" }}
          aria-hidden
        >
          F
        </span>
        <span className="min-w-0">
          <span className="block text-[10px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
            Fuelboard
          </span>
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {subtitle}
          </span>
        </span>
      </Link>
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
