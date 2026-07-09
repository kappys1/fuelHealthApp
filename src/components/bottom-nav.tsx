"use client";

import { Activity, CalendarDays, HeartPulse, Ruler, TrendingUp } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/hoy", label: "Hoy", Icon: Activity },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/salud", label: "Salud", Icon: HeartPulse },
  { href: "/med", label: "MED", Icon: Ruler },
  { href: "/tendencia", label: "Tendencia", Icon: TrendingUp },
] as const;

/**
 * Nav inferior fija de 5 pestañas, estilo marcador (05-DISENO §4):
 * etiquetas condensed uppercase, activa con subrayado grueso --primary,
 * respetando safe-area-inset-bottom.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <ul className="mx-auto flex w-full max-w-[560px]">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
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
