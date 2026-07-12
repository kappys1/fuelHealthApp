"use client";

import {
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/*
  Composición corporal por MED (F5.3): doble eje. Peso y músculo comparten el eje
  IZQUIERDO (kg, escala grande ~50-95); la grasa va en el eje DERECHO (kg, escala
  pequeña ~8-11) para que su variación sea legible. Colores desde tokens (SVG
  resuelve var()): músculo en verde --protein (subir = bien), grasa en --fat.
*/
export interface CompositionPointVM {
  label: string;
  weight: number | null;
  muscle: number | null;
  fat: number | null;
}

export function CompositionChart({ data }: { data: CompositionPointVM[] }) {
  if (data.length < 2) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Necesitas al menos dos mediciones para ver la evolución.
      </p>
    );
  }

  const left = data.flatMap((d) =>
    [d.weight, d.muscle].filter((v): v is number => v != null),
  );
  const fats = data.map((d) => d.fat).filter((v): v is number => v != null);
  const leftMin = Math.floor(Math.min(...left) - 1);
  const leftMax = Math.ceil(Math.max(...left) + 1);
  const fatMin = fats.length ? Math.floor(Math.min(...fats) - 1) : 0;
  const fatMax = fats.length ? Math.ceil(Math.max(...fats) + 1) : 1;

  return (
    <div className="h-60 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: -8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={16}
          />
          <YAxis
            yAxisId="left"
            domain={[leftMin, leftMax]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            domain={[fatMin, fatMax]}
            tick={{ fontSize: 11, fill: "var(--fat)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip unit="kg" />} />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="weight"
            name="Peso"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            dot={{ r: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="muscle"
            name="Músculo"
            stroke="var(--protein)"
            strokeWidth={2.5}
            dot={{ r: 2 }}
            connectNulls
            isAnimationActive={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="fat"
            name="Grasa"
            stroke="var(--fat)"
            strokeWidth={2.5}
            dot={{ r: 2 }}
            connectNulls
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
