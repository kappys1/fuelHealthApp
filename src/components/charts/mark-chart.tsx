"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  type TooltipContentProps,
  XAxis,
  YAxis,
} from "recharts";
import { labelForKey } from "@/lib/dates";
import {
  formatMarkValue,
  type MarkEntryLike,
  type MeasureType,
} from "@/lib/marks";

/*
  Gráfica de progresión de una marca (F03 / 05-DISENO §5): línea --primary con el
  RÉCORD ("mejor") marcado como punto --protein. Tema-consciente vía tokens; el
  tiempo se muestra como mm:ss en eje y tooltip (nada de segundos crudos).
*/
interface MarkChartPointVM {
  label: string;
  value: number;
  best: boolean;
}

export function MarkChart({
  measureType,
  unit,
  entries,
  bestId,
}: {
  measureType: MeasureType;
  unit: string;
  entries: readonly MarkEntryLike[];
  bestId: number | null;
}) {
  if (entries.length < 2) {
    return (
      <p className="py-6 text-center text-[12px] text-muted-foreground">
        {entries.length === 0
          ? "Sin registros todavía."
          : "Añade otra entrada para ver la progresión."}
      </p>
    );
  }

  const data: MarkChartPointVM[] = entries.map((e) => ({
    label: labelForKey(e.recordedOn),
    value: e.value,
    best: e.id === bestId,
  }));
  const values = data.map((d) => d.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.12, hi === lo ? Math.abs(hi) * 0.05 || 1 : 0.5);

  const fmt = (v: number) => formatMarkValue(measureType, v, unit);

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 10, bottom: 0, left: -6 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={20}
          />
          <YAxis
            domain={[lo - pad, hi + pad]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => fmt(Number(v))}
          />
          <Tooltip content={<MarkTooltip fmt={fmt} />} />
          <Line
            type="monotone"
            dataKey="value"
            name="Marca"
            stroke="var(--primary)"
            strokeWidth={2.5}
            isAnimationActive={false}
            dot={<BestDot />}
            activeDot={{ r: 4, fill: "var(--primary)" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Punto normal pequeño; el récord ("mejor") se resalta en --protein más grande.
function BestDot(props: {
  cx?: number;
  cy?: number;
  payload?: MarkChartPointVM;
}) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null) return null;
  const best = payload?.best;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={best ? 5 : 3}
      fill={best ? "var(--protein)" : "var(--primary)"}
      stroke="var(--surface)"
      strokeWidth={best ? 2 : 1}
    />
  );
}

function MarkTooltip({
  active,
  payload,
  label,
  fmt,
}: Partial<TooltipContentProps<number, string>> & {
  fmt: (v: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0];
  const best = (p?.payload as MarkChartPointVM | undefined)?.best;
  return (
    <div className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-sm">
      <div className="mb-0.5 font-medium text-foreground">{label}</div>
      <div className="num text-foreground">
        {typeof p?.value === "number" ? fmt(p.value) : p?.value}
        {best ? (
          <span className="ml-1.5 text-[10.5px] font-bold text-[var(--protein)]">
            récord
          </span>
        ) : null}
      </div>
    </div>
  );
}
