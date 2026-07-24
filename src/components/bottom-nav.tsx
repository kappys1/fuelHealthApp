"use client";

import { CalendarDays, ChartNoAxesCombined, House, MessageCircle } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";

// 4 pestañas (09-FLUJOS-UX §2). Ajustes NO es pestaña: va en el header.
const TABS = [
  { href: "/hoy", label: "Hoy", Icon: House },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/progreso", label: "Progreso", Icon: ChartNoAxesCombined },
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
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface shadow-[0_-8px_24px_rgb(15_27_42/0.04)] transition-transform dark:shadow-[0_-8px_24px_rgb(0_0_0/0.18)] ${
        kbOpen ? "translate-y-full" : "translate-y-0"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-hidden={kbOpen}
      inert={kbOpen ? true : undefined}
      aria-label="Navegación principal"
    >
      <ul className="mx-auto grid h-[72px] w-full max-w-[560px] grid-cols-4 px-2">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                prefetch
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1.5 text-[11px] font-semibold transition-colors ${
                  active
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="size-5" strokeWidth={active ? 2.2 : 1.8} aria-hidden />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
