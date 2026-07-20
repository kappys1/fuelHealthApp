"use client";

import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Ruler,
  Target,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MarksRail } from "@/components/marks/marks-rail";
import { labelForKey, shiftDayKey } from "@/lib/dates";
import {
  type GrpKey,
  MEAL_LABELS,
  MEAL_ORDER,
  phaseLabel,
  type MealKey,
} from "@/lib/macros";
import type { DailyRecord } from "@/server/analytics/types";
import { TRAINING_TIPO_LABELS } from "@/lib/training";
import type {
  HistDieta,
  HistEntreno,
  HistorialEntry,
  HistorialKind,
} from "@/server/db/queries/history";
import type { MarkDTO } from "@/server/db/queries/marks";

const num = (n: number, d = 0) =>
  n.toLocaleString("es-ES", { maximumFractionDigits: d });

const TYPE: Record<
  HistorialKind,
  { color: string; label: string; Icon: typeof Target }
> = {
  objetivo: { color: "var(--primary)", label: "OBJETIVO", Icon: Target },
  dieta: { color: "var(--carb)", label: "DIETA", Icon: UtensilsCrossed },
  entreno: { color: "var(--protein)", label: "ENTRENO", Icon: Dumbbell },
  med: { color: "var(--med-accent)", label: "MED", Icon: Ruler },
};

const GRP_COLOR: Record<GrpKey, string> = {
  Verdura: "var(--protein)",
  Hidratos: "var(--carb)",
  Proteína: "var(--primary)",
  Grasa: "var(--fat)",
  Otros: "var(--muted-foreground)",
  "Opción única": "var(--muted-foreground)",
};

type Range = "3m" | "6m" | "year" | "all" | "custom";
const RANGES: { key: Range; label: string }[] = [
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "year", label: "Año" },
  { key: "all", label: "Todo" },
];
const TYPE_FILTERS: { key: HistorialKind | "all"; label: string }[] = [
  { key: "all", label: "Todo" },
  { key: "objetivo", label: "Objetivos" },
  { key: "dieta", label: "Dieta" },
  { key: "entreno", label: "Entreno" },
  { key: "med", label: "MED" },
];

export function Historial({
  entries,
  records,
  today,
  marks,
  range,
  type,
  from,
  to,
  progressRange,
  summaryDays,
}: {
  entries: HistorialEntry[];
  records: DailyRecord[];
  today: string;
  marks: MarkDTO[];
  range: Range;
  type: HistorialKind | "all";
  from: string;
  to: string;
  progressRange: "14" | "30" | "90" | "todo";
  summaryDays: 7 | 30;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<HistDieta | HistEntreno | null>(null);

  const historyHref = ({
    nextRange = range,
    nextType = type,
    nextFrom = from,
    nextTo = to,
  }: {
    nextRange?: Range;
    nextType?: HistorialKind | "all";
    nextFrom?: string;
    nextTo?: string;
  } = {}) => {
    const params = new URLSearchParams({ tab: "historial" });
    if (progressRange !== "90") params.set("range", progressRange);
    if (summaryDays !== 7) params.set("summary", String(summaryDays));
    if (nextRange !== "all") params.set("historyRange", nextRange);
    if (nextType !== "all") params.set("historyType", nextType);
    if (nextRange === "custom" && nextFrom) params.set("from", nextFrom);
    if (nextRange === "custom" && nextTo) params.set("to", nextTo);
    return `/progreso?${params.toString()}`;
  };

  const filtered = useMemo(() => {
    let list = entries;
    if (range === "custom") {
      list = list.filter((e) => (!from || e.date >= from) && (!to || e.date <= to));
    } else if (range !== "all") {
      const days = range === "3m" ? 90 : range === "6m" ? 180 : 365;
      const cutoff = shiftDayKey(today, -days);
      list = list.filter((e) => e.date >= cutoff);
    }
    if (type !== "all") list = list.filter((e) => e.kind === type);
    return list;
  }, [entries, range, from, to, type, today]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="app-section-title">Tu historial</h2>
        <p className="section-copy">Objetivos, pautas y mediciones en una cronología</p>
      </div>

      {/* Carril de marcas (F03): consulta rápida; abre el mismo sheet de detalle. */}
      <MarksRail initialMarks={marks} today={today} />

      <RecentDays records={records} />

      <div>
        <h2 className="app-section-title">Historial completo</h2>
        <p className="section-copy">Filtra versiones, objetivos y mediciones</p>
      </div>

      {/* rango temporal */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {RANGES.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            on={range === r.key}
            href={historyHref({ nextRange: r.key })}
          />
        ))}
        <Chip
          label="Rango"
          on={range === "custom"}
          dashed
          Icon={CalendarDays}
          href={historyHref({ nextRange: "custom" })}
        />
      </div>
      {range === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) =>
              router.replace(historyHref({ nextRange: "custom", nextFrom: e.target.value }), {
                scroll: false,
              })
            }
            max={today}
            className="num h-11 min-w-0 flex-1 rounded-xl border border-input bg-surface px-2 text-base outline-none focus-visible:border-ring"
            aria-label="Desde"
          />
          <span className="text-[12px] text-muted-foreground">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) =>
              router.replace(historyHref({ nextRange: "custom", nextTo: e.target.value }), {
                scroll: false,
              })
            }
            max={today}
            className="num h-11 min-w-0 flex-1 rounded-xl border border-input bg-surface px-2 text-base outline-none focus-visible:border-ring"
            aria-label="Hasta"
          />
        </div>
      ) : null}

      {/* filtros por tipo */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            on={type === t.key}
            dot={t.key === "all" ? undefined : TYPE[t.key].color}
            href={historyHref({ nextType: t.key })}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="wellness-card p-6 text-center text-[13px] text-muted-foreground ring-1 ring-dashed ring-line">
          Nada en este rango.
        </p>
      ) : (
        <div className="relative pl-8">
          <div
            className="absolute bottom-1.5 left-[11px] top-1.5 w-0.5 bg-line"
            aria-hidden
          />
          {filtered.map((e, i) => (
            <TimelineItem
              key={`${e.kind}-${e.date}-${i}`}
              entry={e}
              onOpenDetail={setDetail}
            />
          ))}
        </div>
      )}

      {detail?.kind === "dieta" ? (
        <DietaSheet entry={detail} onClose={() => setDetail(null)} />
      ) : null}
      {detail?.kind === "entreno" ? (
        <EntrenoSheet entry={detail} onClose={() => setDetail(null)} />
      ) : null}
    </section>
  );
}

function RecentDays({ records }: { records: DailyRecord[] }) {
  const recent = records.slice(-7).reverse();
  return (
    <section aria-labelledby="recent-days-title">
      <div className="mb-3">
        <h2 id="recent-days-title" className="app-section-title">
          Últimos días
        </h2>
        <p className="section-copy">Peso, ingesta y contexto real</p>
      </div>
      {recent.length === 0 ? (
        <p className="wellness-card p-5 text-[12px] text-muted-foreground">
          Aún no hay días registrados.
        </p>
      ) : (
        <div className="wellness-card divide-y divide-line overflow-hidden">
          {recent.map((record) => {
            const context = [
              record.steps != null
                ? `${record.steps.toLocaleString("es-ES")} pasos`
                : null,
              record.hrvMs != null ? `HRV ${Math.round(record.hrvMs)}` : null,
              record.activeKcal != null ? `${Math.round(record.activeKcal)} activas` : null,
              record.phase != null ? phaseLabel(record.phase) : null,
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <div key={record.date} className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-3 px-4 py-3.5">
                <span className="num text-[11px] font-semibold text-muted-foreground">
                  {chartDate(record.date)}
                </span>
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-foreground">
                      {record.sessionLabel ?? "Sin sesión registrada"}
                    </span>
                    <span className="num shrink-0 text-right text-[11px] font-semibold text-foreground">
                      {record.weight != null
                        ? `${record.weight.toLocaleString("es-ES", {
                            maximumFractionDigits: 1,
                          })} kg`
                        : "— kg"}
                      <span className="block font-normal text-muted-foreground">
                        {record.logged
                          ? `${Math.round(record.kcal).toLocaleString("es-ES")} kcal`
                          : "sin ingesta"}
                      </span>
                    </span>
                  </div>
                  {context ? (
                    <p className="mt-1 truncate text-[10.5px] text-muted-foreground">{context}</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

const chartDate = (date: string) => labelForKey(date).replace(/^\S+\s/, "");

function Chip({
  label,
  on,
  dot,
  dashed,
  href,
  Icon,
}: {
  label: string;
  on: boolean;
  dot?: string;
  dashed?: boolean;
  href: string;
  Icon?: typeof CalendarDays;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-[12px] font-semibold ${
        on
          ? "border border-primary bg-primary-soft text-primary-strong"
          : "border border-line bg-surface text-muted-foreground"
      } ${dashed ? "border-dashed" : ""}`}
    >
      {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
      {dot ? (
        <span
          className="size-[7px] rounded-full"
          style={{ background: dot }}
          aria-hidden
        />
      ) : null}
      {label}
    </Link>
  );
}

function TimelineItem({
  entry,
  onOpenDetail,
}: {
  entry: HistorialEntry;
  onOpenDetail: (e: HistDieta | HistEntreno) => void;
}) {
  const [open, setOpen] = useState(false);
  const t = TYPE[entry.kind];
  const expandable = entry.kind === "objetivo" || entry.kind === "med";
  const hasSheet = entry.kind === "dieta" || entry.kind === "entreno";

  return (
    <div className="relative mb-3">
      <span
        className="absolute -left-8 top-3.5 flex size-[23px] items-center justify-center rounded-full border-2 bg-surface-2"
        style={{ borderColor: t.color, color: t.color }}
        aria-hidden
      >
        <t.Icon className="size-3" />
      </span>
      <button
        type="button"
        onClick={() => {
          if (hasSheet) onOpenDetail(entry as HistDieta | HistEntreno);
          else if (expandable) setOpen((v) => !v);
        }}
        className="wellness-card min-h-11 w-full p-4 text-left ring-1 ring-line"
      >
        <div className="flex items-center justify-between gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[10.5px] font-bold tracking-wide"
            style={{
              color: t.color,
              background: `color-mix(in srgb, ${t.color} 18%, transparent)`,
            }}
          >
            {t.label}
          </span>
          <span className="num text-[11.5px] text-muted-foreground">
            {labelForKey(entry.date)}
          </span>
        </div>

        <div className="mt-1.5 flex items-start justify-between gap-2 text-[13.5px]">
          <span className="min-w-0">{summaryOf(entry)}</span>
          {hasSheet ? (
            <span className="shrink-0 text-[12px] text-muted-foreground">
              detalle ›
            </span>
          ) : expandable ? (
            open ? (
              <ChevronUp className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            ) : (
              <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            )
          ) : null}
        </div>

        {open && entry.kind === "med" ? <MedDetail entry={entry} /> : null}
        {open && entry.kind === "objetivo" ? (
          <div className="mt-2 border-t border-line pt-2 text-[12px] text-muted-foreground">
            {entry.pesoObjetivo != null ? (
              <div className="mb-1">Meta: {num(entry.pesoObjetivo, 1)} kg</div>
            ) : null}
            <p>{entry.texto}</p>
            <div className="mt-1">Desde {labelForKey(entry.date)}</div>
          </div>
        ) : null}
      </button>
    </div>
  );
}

function summaryOf(e: HistorialEntry): React.ReactNode {
  switch (e.kind) {
    case "objetivo":
      return <>Objetivo: {e.texto}</>;
    case "dieta":
      return (
        <>
          Dieta — <b>{num(e.kcal)} kcal</b> · {num(e.prot)} g proteína
        </>
      );
    case "entreno":
      return (
        <>
          {e.programa} · <b>{e.etiqueta}</b> — {e.sessions.length} sesiones
        </>
      );
    case "med":
      return (
        <>
          Pliegues — grasa <b>{e.fatKg == null ? "—" : `${num(e.fatKg, 1)} kg`}</b> · músculo{" "}
          <b>{e.muscleKg == null ? "—" : `${num(e.muscleKg, 1)} kg`}</b>
        </>
      );
  }
}

function MedDetail({ entry }: { entry: Extract<HistorialEntry, { kind: "med" }> }) {
  return (
    <div className="mt-2 grid gap-1.5 border-t border-line pt-2 text-[12px]">
      <DeltaRow label="Grasa" value={entry.fatKg} unit="kg" delta={entry.delta.fatKg} good="down" />
      <DeltaRow label="Músculo" value={entry.muscleKg} unit="kg" delta={entry.delta.muscleKg} good="up" />
      <DeltaRow label="Peso" value={entry.weightKg} unit="kg" delta={entry.delta.weightKg} good="neutral" />
    </div>
  );
}

function DeltaRow({
  label,
  value,
  unit,
  delta,
  good,
}: {
  label: string;
  value: number | null;
  unit: string;
  delta: number | null;
  good: "up" | "down" | "neutral";
}) {
  if (value == null) return null;
  let cls = "text-muted-foreground";
  if (delta != null && delta !== 0 && good !== "neutral") {
    const isGood = good === "up" ? delta > 0 : delta < 0;
    cls = isGood ? "text-[var(--protein)]" : "text-[var(--fat)]";
  }
  return (
    <div className="flex justify-between gap-2">
      <span className="text-foreground">{label}</span>
      <span className="num text-muted-foreground">
        {num(value, unit === "%" ? 2 : 1)} {unit}
        {delta != null && delta !== 0 ? (
          <>
            {" · "}
            <span className={cls}>
              {delta > 0 ? "+" : ""}
              {num(delta, 2)}
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}

function DietaSheet({ entry, onClose }: { entry: HistDieta; onClose: () => void }) {
  const router = useRouter();
  const byMeal = MEAL_ORDER.filter((m) => m !== "extra")
    .map((m) => ({
      meal: m as MealKey,
      opts: entry.options.filter((o) => o.meal === m),
    }))
    .filter((g) => g.opts.length > 0);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle>Dieta · {labelForKey(entry.date)}</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-8">
          <p className="mb-3 text-[12px] text-muted-foreground">
            Foto de cómo estaba la pauta ese día (solo lectura).
          </p>
          <div className="mb-3 grid grid-cols-4 gap-2">
            <Metric b={num(entry.kcal)} s="kcal" />
            <Metric b={num(entry.prot)} s="P" />
            <Metric b={entry.carb != null ? num(entry.carb) : "—"} s="C" />
            <Metric b={entry.fat != null ? num(entry.fat) : "—"} s="G" />
          </div>
          {byMeal.map((g) => (
            <div key={g.meal} className="mb-3">
              <h4 className="mb-1.5 text-[11.5px] font-bold uppercase tracking-wide text-muted-foreground">
                {MEAL_LABELS[g.meal]} · {g.opts.length} opciones
              </h4>
              <div className="divide-y divide-line">
                {g.opts.map((o) => (
                  <div key={o.id} className="flex items-center gap-2 py-1.5">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: GRP_COLOR[o.grp] }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-[13px]">{o.name}</span>
                    <span className="num shrink-0 text-[11px] text-muted-foreground">
                      {o.baseG != null ? `${o.baseG} g · ` : ""}
                      {o.kcal} kcal
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => router.push("/plan?tab=dieta")}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/15 py-3 text-[14px] font-semibold text-foreground"
          >
            Ver plan actual <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EntrenoSheet({
  entry,
  onClose,
}: {
  entry: HistEntreno;
  onClose: () => void;
}) {
  const router = useRouter();
  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-1">
          <SheetTitle>
            {entry.programa} · {entry.etiqueta}
          </SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-8">
          <p className="num mb-3 text-[12px] text-muted-foreground">
            {labelForKey(entry.validFrom)}
            {entry.validTo ? ` – ${labelForKey(entry.validTo)}` : ""} ·{" "}
            {entry.sessions.length} sesiones · solo lectura
          </p>
          {entry.sessions.map((s) => (
            <div
              key={s.id}
              className="mb-2.5 rounded-xl border border-line bg-surface-2 p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">
                  {s.key} · {s.nombre}
                </span>
                <span
                  className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{
                    color: "var(--protein)",
                    background: "color-mix(in srgb, var(--protein) 18%, transparent)",
                  }}
                >
                  {TRAINING_TIPO_LABELS[s.tipo]}
                </span>
              </div>
              <div className="num mt-0.5 text-[11px] text-muted-foreground">
                {s.duracionMin != null ? `${s.duracionMin} min · ` : ""}
                {s.kcalMin != null || s.kcalMax != null
                  ? `${s.kcalMin ?? "?"}–${s.kcalMax ?? "?"} kcal`
                  : ""}
              </div>
              {s.contenido ? (
                <p className="mt-1.5 text-[12px] leading-relaxed text-foreground/90">
                  {s.contenido}
                </p>
              ) : null}
            </div>
          ))}
          <button
            type="button"
            onClick={() => router.push("/plan?tab=entrenos")}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-primary bg-primary/15 py-3 text-[14px] font-semibold text-foreground"
          >
            Ver semana actual <ArrowRight className="size-4" aria-hidden />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ b, s }: { b: string; s: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface-2 py-2 text-center">
      <b className="num block text-[15px]">{b}</b>
      <span className="text-[10px] text-muted-foreground">{s}</span>
    </div>
  );
}
