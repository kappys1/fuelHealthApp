"use client";

import type { TooltipContentProps } from "recharts";

/*
  Tooltip tematizado con nuestros tokens (05-DISENO §5: fondo --surface, sin
  gridlines agresivas). Compartido por los gráficos de peso e ingesta. Recharts
  inyecta active/payload/label al clonar el elemento, así que aquí son opcionales.
*/
export function ChartTooltip({
  active,
  payload,
  label,
  unit,
}: Partial<TooltipContentProps<number, string>> & { unit?: string }) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-sm">
      <div className="mb-0.5 font-medium text-foreground">{label}</div>
      {payload.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2 rounded-full"
            style={{ background: p.color }}
            aria-hidden
          />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="num text-foreground">
            {typeof p.value === "number"
              ? p.value.toLocaleString("es-ES", { maximumFractionDigits: 1 })
              : p.value}
            {unit ? ` ${unit}` : ""}
          </span>
        </div>
      ))}
    </div>
  );
}
