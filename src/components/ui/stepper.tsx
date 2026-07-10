"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const toNum = (s: string) => (s === "" ? NaN : Number(s.replace(",", ".")));

/**
 * Stepper numérico (07 §2 / 05-DISENO §4): −/+ con paso, `inputMode="decimal"`,
 * acepta coma Y punto (normaliza a punto), selección total al enfocar.
 *
 * Mantiene un BUFFER de texto interno: preserva lo que el usuario teclea (p. ej.
 * "92," a medio escribir) aunque el padre re-derive `value` desde un número —que
 * perdería el separador—. Solo adopta `value` cuando cambia de verdad
 * numéricamente desde fuera (cambio de día, precarga, etc.). El input nunca se
 * desmonta al vaciarlo (lección del PoC).
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
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);

  // Cuando el padre manda un `value` NUEVO, adoptarlo solo si difiere
  // numéricamente de lo mostrado (cambio externo real: cambio de día, precarga…).
  // Si coincide en número (el round-trip de nuestra propia edición), preservamos
  // lo tecleado —así no se pierde la coma a medio escribir—. Patrón oficial de
  // React de ajuste de estado durante el render.
  if (value !== prevValue) {
    setPrevValue(value);
    if (toNum(value) !== toNum(text)) setText(value);
  }

  const num = Number.isNaN(toNum(text)) ? 0 : toNum(text);
  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return Math.round(v * 100) / 100; // evita arrastrar decimales binarios
  };
  const emit = (t: string) => {
    setText(t);
    onChange(t);
  };
  const bump = (delta: number) => emit(String(clamp(num + delta)));

  return (
    <div
      className={cn(
        "inline-flex items-stretch overflow-hidden rounded-lg border border-line",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Restar"
        onClick={() => bump(-step)}
        className="flex w-10 shrink-0 items-center justify-center bg-surface-2 text-foreground active:translate-y-px"
      >
        <Minus className="size-4" aria-hidden />
      </button>
      <div className="flex min-w-0 flex-1 items-center">
        <input
          aria-label={ariaLabel}
          value={text}
          inputMode="decimal"
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === "" || /^[0-9]*[.,]?[0-9]*$/.test(raw)) emit(raw);
          }}
          className="num h-11 w-full min-w-[3rem] bg-transparent px-1 text-center text-base outline-none"
        />
        {suffix ? (
          <span className="shrink-0 pr-2 text-[12px] text-muted-foreground">
            {suffix}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Sumar"
        onClick={() => bump(step)}
        className="flex w-10 shrink-0 items-center justify-center bg-surface-2 text-foreground active:translate-y-px"
      >
        <Plus className="size-4" aria-hidden />
      </button>
    </div>
  );
}
