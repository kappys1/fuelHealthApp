"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const CHOICES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;
type ThemeChoice = (typeof CHOICES)[number]["value"];

const LABEL: Record<ThemeChoice, string> = {
  light: "Claro",
  dark: "Oscuro",
  system: "Sistema",
};

/**
 * Selector explícito claro/oscuro/sistema. Se monta tras hidratar para evitar el
 * desajuste de next-themes y nunca obliga a descubrir un ciclo oculto.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Guard de hidratación de next-themes: hasta montar en cliente no sabemos el
  // tema resuelto. El setState en efecto es intencionado (patrón oficial).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const current: ThemeChoice =
    mounted && CHOICES.some((choice) => choice.value === theme)
      ? (theme as ThemeChoice)
      : "system";

  return (
    <div
      className="grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1.5"
      role="group"
      aria-label="Tema de la aplicación"
    >
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const selected = mounted && current === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={selected}
            aria-label={`Usar tema ${LABEL[value]}`}
            className={`inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold transition-colors focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none ${
              selected
                ? "bg-surface text-primary shadow-sm ring-1 ring-line"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
