"use client";

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

export interface IntakePointVM {
  label: string;
  proteinKcal: number;
  carbKcal: number;
  fatKcal: number;
  macroKcal: number;
  recordedKcal: number;
  discrepancyKcal: number;
  targetKcal: number;
  special: boolean;
}

export function IntakeChart({ data }: { data: IntakePointVM[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-[13px] text-muted-foreground">
        Sin comidas registradas en este rango.
      </p>
    );
  }
  const max = Math.max(
    ...data.flatMap((point) => [point.targetKcal, point.macroKcal, point.recordedKcal]),
  );

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--line-soft)" strokeDasharray="3 3" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--muted-text)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--line-soft)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[0, Math.ceil((max + 100) / 100) * 100]}
            tick={{ fontSize: 11, fill: "var(--muted-text)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(value: number) =>
              value >= 1000
                ? `${(value / 1000).toLocaleString("es-ES", {
                    maximumFractionDigits: 1,
                  })}k`
                : String(value)
            }
          />
          <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<IntakeTooltip />} />
          <Bar
            dataKey="proteinKcal"
            name="Proteína"
            stackId="macros"
            fill="var(--protein)"
            radius={[0, 0, 3, 3]}
            isAnimationActive={false}
          >
            {data.map((point) => (
              <Cell
                key={`protein-${point.label}`}
                fillOpacity={1}
                stroke={point.special ? "var(--info)" : "none"}
                strokeWidth={point.special ? 1 : 0}
              />
            ))}
          </Bar>
          <Bar
            dataKey="carbKcal"
            name="Hidratos"
            stackId="macros"
            fill="var(--carb)"
            isAnimationActive={false}
          >
            {data.map((point) => (
              <Cell
                key={`carb-${point.label}`}
                fillOpacity={1}
                stroke={point.special ? "var(--info)" : "none"}
                strokeWidth={point.special ? 1 : 0}
              />
            ))}
          </Bar>
          <Bar
            dataKey="fatKcal"
            name="Grasa"
            stackId="macros"
            fill="var(--fat)"
            radius={[3, 3, 0, 0]}
            isAnimationActive={false}
          >
            {data.map((point) => (
              <Cell
                key={`fat-${point.label}`}
                fillOpacity={1}
                stroke={point.special ? "var(--info)" : "none"}
                strokeWidth={point.special ? 1 : 0}
              />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="recordedKcal"
            name="Kcal registradas"
            stroke="var(--muted-text)"
            strokeWidth={1}
            strokeDasharray="2 3"
            strokeOpacity={0.75}
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
          <Line
            type="stepAfter"
            dataKey="targetKcal"
            name="Objetivo"
            stroke="var(--primary)"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            dot={false}
            activeDot={{ r: 3 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function TooltipRow({
  name,
  value,
  color,
}: {
  name: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        {color ? (
          <span className="size-2 rounded-full" style={{ background: color }} aria-hidden />
        ) : null}
        {name}
      </span>
      <span className="num font-medium text-foreground">
        {Math.round(value).toLocaleString("es-ES")} kcal
      </span>
    </div>
  );
}

function IntakeTooltip({
  active,
  payload,
  label,
}: Partial<TooltipContentProps<number, string>>) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload as IntakePointVM | undefined;
  if (!point) return null;
  return (
    <div className="min-w-48 rounded-xl border border-line bg-surface p-3 text-[11px] shadow-card">
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="font-semibold text-foreground">{label}</span>
        {point.special ? (
          <span className="rounded-full bg-info/10 px-2 py-0.5 text-[10px] font-semibold text-info">
            fase
          </span>
        ) : null}
      </div>
      <div className="space-y-1">
        <TooltipRow name="Proteína" value={point.proteinKcal} color="var(--protein)" />
        <TooltipRow name="Hidratos" value={point.carbKcal} color="var(--carb)" />
        <TooltipRow name="Grasa" value={point.fatKcal} color="var(--fat)" />
      </div>
      <div className="mt-2 space-y-1 border-t border-line pt-2">
        <TooltipRow name="Registrado" value={point.recordedKcal} />
        <TooltipRow name="Objetivo" value={point.targetKcal} />
        <TooltipRow name="Diferencia" value={point.discrepancyKcal} />
      </div>
    </div>
  );
}
