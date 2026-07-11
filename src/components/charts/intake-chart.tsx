"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/*
  Barras de ingesta diaria con ReferenceLine del objetivo (F6.4 / 05-DISENO §5).
  Barra en --primary; los días fuera de fase Normal se atenúan (contexto, no
  desviación — principio 4). Línea de objetivo en --fat.
*/
export interface IntakePointVM {
  label: string;
  kcal: number;
  special: boolean;
}

export function IntakeChart({
  data,
  target,
}: {
  data: IntakePointVM[];
  target: number;
}) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Sin comidas registradas en este rango.
      </p>
    );
  }
  const max = Math.max(target, ...data.map((d) => d.kcal));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, Math.ceil((max + 100) / 100) * 100]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip unit="kcal" />} />
          <ReferenceLine
            y={target}
            stroke="var(--fat)"
            strokeDasharray="4 3"
            strokeWidth={1.5}
            label={{
              value: `objetivo ${target}`,
              position: "insideTopRight",
              fill: "var(--fat)",
              fontSize: 10,
            }}
          />
          <Bar dataKey="kcal" name="Ingesta" radius={[3, 3, 0, 0]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill="var(--primary)" fillOpacity={d.special ? 0.4 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
