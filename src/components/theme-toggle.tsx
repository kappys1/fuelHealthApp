"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const ORDER = ["light", "dark", "system"] as const;
type ThemeChoice = (typeof ORDER)[number];

const LABEL: Record<ThemeChoice, string> = {
  light: "Claro",
  dark: "Oscuro",
  system: "Auto",
};

/**
 * Ciclo claro → oscuro → auto (sistema). El icono refleja la elección actual.
 * Se monta tras hidratar para evitar el desajuste de next-themes.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Guard de hidratación de next-themes: hasta montar en cliente no sabemos el
  // tema resuelto. El setState en efecto es intencionado (patrón oficial).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice =
    mounted && ORDER.includes(theme as ThemeChoice)
      ? (theme as ThemeChoice)
      : "system";

  const next: ThemeChoice =
    ORDER[(ORDER.indexOf(current) + 1) % ORDER.length] ?? "system";
  const Icon =
    current === "light" ? Sun : current === "dark" ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={`Tema: ${LABEL[current]}. Cambiar a ${LABEL[next]}`}
      title={`Tema: ${LABEL[current]}`}
      className="inline-flex h-11 items-center gap-2 rounded-md border border-input bg-surface px-3.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
    >
      <Icon className="size-4" aria-hidden />
      <span>{mounted ? LABEL[current] : "Tema"}</span>
    </button>
  );
}
