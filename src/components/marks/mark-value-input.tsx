"use client";

import type { MeasureType } from "@/lib/marks";

/*
  Input de valor de marca (F03). Tiempo → texto mm:ss; resto → numérico con la
  unidad como sufijo. Devuelve la cadena cruda; el submit la parsea con
  parseMarkValue. 16px (evita zoom iOS, 05-DISENO §3).
*/
export function MarkValueInput({
  measureType,
  unit,
  value,
  onChange,
  ariaLabel = "Valor",
  autoFocus,
}: {
  measureType: MeasureType;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const isTime = measureType === "time";
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-input bg-surface px-3 focus-within:border-ring">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        inputMode={isTime ? "numeric" : "decimal"}
        placeholder={isTime ? "mm:ss" : "0"}
        // biome-ignore lint/a11y/noAutofocus: sheets de captura rápida (09 §4)
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        className="num h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
      />
      <span className="shrink-0 text-[13px] text-muted-foreground">
        {isTime ? "mm:ss" : unit}
      </span>
    </div>
  );
}
