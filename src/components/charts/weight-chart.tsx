"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";

/*
  Gráfico de peso (F6.4 / 05-DISENO §5): línea de peso fina + ma7 gruesa --primary.
  Colores desde los tokens (SVG resuelve var()); tema-consciente sin JS.
*/
export interface WeightPointVM {
  label: string;
  weight: number | null;
  ma7: number | null;
}

export function WeightChart({ data }: { data: WeightPointVM[] }) {
  const weights = data.flatMap((d) =>
    [d.weight, d.ma7].filter((v): v is number => v != null),
  );
  // F22: la serie trae un punto por día del rango, incluidos los días sin pesaje
  // (`weight: null`). Vacío ya no es `data.length === 0`, sino «ningún valor real».
  if (weights.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Sin pesos en este rango.
      </p>
    );
  }
  const min = Math.floor(Math.min(...weights) - 0.5);
  const max = Math.ceil(Math.max(...weights) + 0.5);

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[min, max]}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip content={<ChartTooltip unit="kg" />} />
          {/*
            F22 · AC7 — el peso diario deja de inventar. Antes `connectNulls` +
            `monotone` + `dot={false}` puenteaban los días sin pesaje con una recta
            indistinguible de un dato real: con 19 pesajes en 23 días, cuatro huecos
            se leían como «peso estable». Ahora: sin `connectNulls` (el hueco se ve
            como hueco), `linear` (una medición no se curva) y punto visible en cada
            pesaje real.
          */}
          <Line
            type="linear"
            dataKey="weight"
            name="Peso"
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            dot={{ r: 2, fill: "var(--muted-foreground)", strokeWidth: 0 }}
            activeDot={{ r: 3.5 }}
            isAnimationActive={false}
          />
          {/*
            La ma7 SÍ conserva `connectNulls` y `monotone`: es una media calculada,
            no una medición, y existe en cualquier día con pesaje en su ventana.
          */}
          <Line
            type="monotone"
            dataKey="ma7"
            name="Media 7d"
            stroke="var(--primary)"
            strokeWidth={2.5}
            dot={false}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
