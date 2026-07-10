"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stepper numérico (07 §2): −/+ con paso, inputmode decimal, selección total al
 * enfocar. El input NUNCA se desmonta al vaciarlo (lección del PoC): mantiene el
 * valor como string controlado por el padre.
 */
export function Stepper({
  value,
  onChange,
  step = 10,
  min = 0,
  max,
  suffix,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  step?: number;
  min?: number;
  max?: number;
  suffix?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const num = value === "" ? 0 : Number(value.replace(",", "."));
  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    // Redondeo suave para no arrastrar decimales de coma flotante.
    return Math.round(v * 100) / 100;
  };
  const bump = (delta: number) => onChange(String(clamp(num + delta)));

  return (
    <div className={cn("inline-flex items-stretch overflow-hidden rounded-lg border border-line", className)}>
      <button
        type="button"
        aria-label="Restar"
        onClick={() => bump(-step)}
        className="flex w-10 items-center justify-center bg-surface-2 text-foreground active:translate-y-px"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          aria-label={ariaLabel}
          value={value}
          inputMode="decimal"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || /^[0-9]*[.,]?[0-9]*$/.test(raw)) onChange(raw);
          }}
          className="num h-11 w-full min-w-0 bg-transparent px-2 text-center text-base outline-none"
        />
        {suffix ? (
          <span className="pointer-events-none pr-2 text-[12px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Sumar"
        onClick={() => bump(step)}
        className="flex w-10 items-center justify-center bg-surface-2 text-foreground active:translate-y-px"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
