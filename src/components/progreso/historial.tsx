"use client";

import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  Ruler,
  Target,
  UtensilsCrossed,
} from "lucide-react";
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
  type MealKey,
} from "@/lib/macros";
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
  today,
  marks,
}: {
  entries: HistorialEntry[];
  today: string;
  marks: MarkDTO[];
}) {
  const [range, setRange] = useState<Range>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typeSel, setTypeSel] = useState<HistorialKind | "all">("all");
  const [detail, setDetail] = useState<HistDieta | HistEntreno | null>(null);

  const filtered = useMemo(() => {
    let list = entries;
    if (range === "custom") {
      list = list.filter((e) => (!from || e.date >= from) && (!to || e.date <= to));
    } else if (range !== "all") {
      const days = range === "3m" ? 90 : range === "6m" ? 180 : 365;
      const cutoff = shiftDayKey(today, -days);
      list = list.filter((e) => e.date >= cutoff);
    }
    if (typeSel !== "all") list = list.filter((e) => e.kind === typeSel);
    return list;
  }, [entries, range, from, to, typeSel, today]);

  return (
    <section className="space-y-4">
      <p className="text-[12px] leading-snug text-muted-foreground">
        Cómo has llegado hasta aquí. Solo lectura — el pasado no se edita, solo se
        consulta.
      </p>

      {/* Carril de marcas (F03): consulta rápida; abre el mismo sheet de detalle. */}
      <MarksRail initialMarks={marks} today={today} />

      {/* rango temporal */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {RANGES.map((r) => (
          <Chip
            key={r.key}
            label={r.label}
            on={range === r.key}
            onClick={() => setRange(r.key)}
          />
        ))}
        <Chip
          label="📅 rango…"
          on={range === "custom"}
          dashed
          onClick={() => setRange("custom")}
        />
      </div>
      {range === "custom" ? (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="num h-9 flex-1 rounded-lg border border-input bg-surface px-2 text-[13px] outline-none focus-visible:border-ring"
            aria-label="Desde"
          />
          <span className="text-[12px] text-muted-foreground">→</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="num h-9 flex-1 rounded-lg border border-input bg-surface px-2 text-[13px] outline-none focus-visible:border-ring"
            aria-label="Hasta"
          />
        </div>
      ) : null}

      {/* filtros por tipo */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {TYPE_FILTERS.map((t) => (
          <Chip
            key={t.key}
            label={t.label}
            on={typeSel === t.key}
            dot={t.key === "all" ? undefined : TYPE[t.key].color}
            onClick={() => setTypeSel(t.key)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-2 p-6 text-center text-sm text-muted-foreground">
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

function Chip({
  label,
  on,
  dot,
  dashed,
  onClick,
}: {
  label: string;
  on: boolean;
  dot?: string;
  dashed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] ${
        on
          ? "border border-primary bg-primary/15 text-foreground"
          : "border border-line bg-surface-2 text-muted-foreground"
      } ${dashed ? "border-dashed" : ""}`}
    >
      {dot ? (
        <span
          className="size-[7px] rounded-full"
          style={{ background: dot }}
          aria-hidden
        />
      ) : null}
      {label}
    </button>
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
        className="w-full rounded-xl border border-line bg-surface p-3 text-left shadow-[var(--card-shadow)]"
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
          Pliegues — grasa <b>{num(e.fatKg ?? 0, 1)} %</b> · músculo{" "}
          <b>{num(e.muscleKg ?? 0, 1)} kg</b>
        </>
      );
  }
}

function MedDetail({ entry }: { entry: Extract<HistorialEntry, { kind: "med" }> }) {
  return (
    <div className="mt-2 grid gap-1.5 border-t border-line pt-2 text-[12px]">
      <DeltaRow label="Grasa" value={entry.fatKg} unit="%" delta={entry.delta.fatKg} good="down" />
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
