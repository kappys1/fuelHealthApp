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

/*
  Ingesta diaria APILADA por contribución calórica (Restyle v2 · F2 / F6.4):
  cada barra reparte las kcal del día entre proteína (P×4), hidratos (C×4) y grasa
  (F×9) con el lenguaje de macro fijo. Línea de objetivo en --primary punteada; los
  días de fase especial se atenúan (contexto, no desviación — principio 4). El reparto
  sale de `server/analytics/intake.caloricContribution` (derivación exacta, testeada).
*/
export interface IntakePointVM {
  label: string;
  protKcal: number;
  carbKcal: number;
  fatKcal: number;
  /** Total de kcal REGISTRADO (para el tooltip; puede diferir del apilado por redondeo). */
  kcal: number;
  special: boolean;
}

const SERIES: { key: "protKcal" | "carbKcal" | "fatKcal"; name: string; color: string }[] = [
  { key: "protKcal", name: "Proteína", color: "var(--protein)" },
  { key: "carbKcal", name: "Hidratos", color: "var(--carb)" },
  { key: "fatKcal", name: "Grasa", color: "var(--fat)" },
];

function StackTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: IntakePointVM }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  if (!d) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-[var(--card-shadow)]">
      <p className="font-semibold text-foreground">{d.label}</p>
      <p className="num mt-1 text-foreground">{Math.round(d.kcal).toLocaleString("es-ES")} kcal</p>
      <p className="num mt-0.5 text-muted-foreground">
        <span className="text-protein">{Math.round(d.protKcal)}P</span> ·{" "}
        <span className="text-carb">{Math.round(d.carbKcal)}C</span> ·{" "}
        <span className="text-fat">{Math.round(d.fatKcal)}F</span> kcal
      </p>
      {d.special ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground">fase especial</p>
      ) : null}
    </div>
  );
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
  const max = Math.max(
    target,
    ...data.map((d) => d.protKcal + d.carbKcal + d.fatKcal),
  );

  return (
    <div>
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
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<StackTooltip />} />
            <ReferenceLine
              y={target}
              stroke="var(--primary)"
              strokeDasharray="4 3"
              strokeWidth={1.5}
              label={{
                value: `objetivo ${target}`,
                position: "insideTopRight",
                fill: "var(--primary)",
                fontSize: 10,
              }}
            />
            {SERIES.map((s, si) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.name}
                stackId="kcal"
                radius={si === SERIES.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                isAnimationActive={false}
              >
                {data.map((d, i) => (
                  <Cell key={i} fill={s.color} fillOpacity={d.special ? 0.4 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-center gap-3 text-[11px] text-muted-foreground">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
