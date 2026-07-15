"use client";

import { Activity, CalendarDays, MessageCircle, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";

// 4 pestañas (09-FLUJOS-UX §2). Ajustes NO es pestaña: va en el header.
const TABS = [
  { href: "/hoy", label: "Hoy", Icon: Activity },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/progreso", label: "Progreso", Icon: TrendingUp },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
] as const;

/**
 * Nav inferior fija de 4 pestañas, estilo marcador (05-DISENO §4):
 * etiquetas condensed uppercase, activa con subrayado grueso --primary,
 * respetando safe-area-inset-bottom.
 */
export function BottomNav() {
  const pathname = usePathname();
  // Con `interactiveWidget: "resizes-content"` el teclado encoge el viewport, y un
  // `fixed; bottom:0` queda flotando justo encima del teclado (no pegado al borde
  // de la pantalla). Por eso, en cuanto hay teclado, deslizamos la nav fuera —en
  // CUALQUIER pantalla con input inline (Chat, buscador/edición de Plan…), no solo
  // el Chat. La detección (`useKeyboardOpen`) es por viewport, así que no se queda
  // atascada aunque iOS cierre el teclado con "Done" sin soltar el foco.
  const kbOpen = useKeyboardOpen();

  return (
    <nav
      className={`fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur transition-transform ${
        kbOpen ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={kbOpen}
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex w-full max-w-[560px]">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 pt-1.5 text-[11px] transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" aria-hidden />
                <span
                  className="uppercase tracking-wide"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {label}
                </span>
                <span
                  className={`mt-0.5 h-[3px] w-6 rounded-full ${
                    active ? "bg-primary" : "bg-transparent"
                  }`}
                  aria-hidden
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
