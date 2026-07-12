"use client";

import { Loader2, Pencil, Plus, Sparkles, Trash2, WifiOff } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { CompositionChart } from "@/components/charts/composition-chart";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Markdown } from "@/components/ui/markdown";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client-api";
import { dayKey, labelForKey } from "@/lib/dates";
import { useOnline } from "@/lib/use-online";
import {
  computeMedDeltas,
  type MedMeasurement,
  type MedWithDelta,
} from "@/server/analytics/medDeltas";
import { HowCalculated } from "./how-calculated";

const parseKg = (s: string): number | null =>
  s.trim() === "" ? null : Number(s.replace(",", "."));

/** Quita el `delta` derivado; el estado base guarda solo la medición. */
const stripDelta = (r: MedWithDelta): MedMeasurement => ({
  id: r.id,
  date: r.date,
  fatKg: r.fatKg,
  muscleKg: r.muscleKg,
  weightKg: r.weightKg,
});

const kg = (n: number | null, d = 1) =>
  n == null ? "—" : n.toLocaleString("es-ES", { maximumFractionDigits: d });

/** «mié 8 jul» → «8 jul» para el eje del gráfico. */
const shortLabel = (date: string) => labelForKey(date).replace(/^\S+\s/, "");

/*
  Segmento MED de Progreso (F5). CRUD de mediciones del nutricionista, diferencias
  vs la anterior con signo matemático correcto (SIEMPRE actual − anterior, F5.2) y
  color semántico (grasa↓ verde, músculo↑ verde), gráfico de composición de doble
  eje, entrada retroactiva cómoda y «Preparar visita» (F-IA-7). Las MED se comparan
  solo entre sí (principio 5).
*/
export function Med({ initialMed }: { initialMed: MedWithDelta[] }) {
  // Estado base sin deltas; las diferencias se recalculan (analytics puro).
  const [rows, setRows] = useState<MedMeasurement[]>(() =>
    initialMed.map(stripDelta),
  );
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MedMeasurement | null>(null);
  const [visitOpen, setVisitOpen] = useState(false);

  const withDeltas = useMemo(() => computeMedDeltas(rows), [rows]);
  const desc = useMemo(() => [...withDeltas].reverse(), [withDeltas]);
  const chartData = useMemo(
    () =>
      withDeltas.map((r) => ({
        label: shortLabel(r.date),
        weight: r.weightKg,
        muscle: r.muscleKg,
        fat: r.fatKg,
      })),
    [withDeltas],
  );

  const refresh = async () => {
    try {
      const { med } = await api.listMed();
      setRows(med.map(stripDelta));
    } catch {
      /* la mutación ya actualizó el estado local; el refetch es best-effort */
    }
  };

  const del = async (row: MedMeasurement) => {
    if (!window.confirm(`¿Borrar la medición del ${labelForKey(row.date)}?`)) return;
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    try {
      await api.deleteMed(row.id);
      toast.success("Medición borrada.");
    } catch (err) {
      setRows(prev);
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  };

  return (
    <div className="space-y-4 pb-4">
      {/* Preparar visita (F-IA-7) */}
      <PrepareVisitCard onOpen={() => setVisitOpen(true)} />

      {/* Gráfico de composición doble eje */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <div className="mb-1 flex items-center gap-1.5">
          <h2 className="card-title text-muted-foreground">Composición corporal</h2>
          <HowCalculated
            title="Composición por pliegues (MED)"
            what="Grasa y músculo en kg medidos por tu nutricionista, más el peso que le reportas. Peso y músculo comparten el eje izquierdo; la grasa va en el derecho para que su variación se vea."
            formula="Cada punto es una medición mensual. El músculo por pliegues tiene ruido de hidratación/glucógeno: una medición cerca de carga/competición no es tendencia."
            action="Compara MED con MED (nunca con la báscula). Lo que importa es la dirección a lo largo de varias mediciones."
          />
        </div>
        <CompositionChart data={chartData} />
      </section>

      {/* Historial con diferencias */}
      <section className="rounded-xl border border-line bg-surface">
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="card-title text-muted-foreground">Mediciones</h2>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 py-1.5 text-[13px] font-medium text-foreground"
          >
            <Plus className="size-4 text-primary" aria-hidden />
            Añadir
          </button>
        </div>

        {desc.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-muted-foreground">
            Sin mediciones. Añade tu histórico (el volumen de 2025 y la definición de
            2026) con «Añadir» — la fecha es libre.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {desc.map((r) => (
              <li key={r.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-medium text-foreground">
                    {labelForKey(r.date)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Editar medición"
                      onClick={() => {
                        setEditing(r);
                        setFormOpen(true);
                      }}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="size-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-label="Borrar medición"
                      onClick={() => del(r)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  <Metric label="Grasa" value={r.fatKg} delta={r.delta.fatKg} favor="down" />
                  <Metric label="Músculo" value={r.muscleKg} delta={r.delta.muscleKg} favor="up" />
                  <Metric label="Peso" value={r.weightKg} delta={r.delta.weightKg} favor="neutral" />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {formOpen ? (
        <MedForm
          row={editing}
          onClose={() => setFormOpen(false)}
          onSaved={(row) => {
            setRows((rs) => {
              const others = rs.filter((r) => r.id !== row.id);
              return [...others, row];
            });
            setFormOpen(false);
            void refresh();
          }}
        />
      ) : null}

      <VisitSheet open={visitOpen} onOpenChange={setVisitOpen} />
    </div>
  );
}

// ── Métrica con diferencia coloreada (F5.2) ──
function Metric({
  label,
  value,
  delta,
  favor,
}: {
  label: string;
  value: number | null;
  delta: number | null;
  favor: "up" | "down" | "neutral";
}) {
  return (
    <div className="rounded-lg bg-surface-2 px-2 py-2">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="num text-[16px] font-semibold text-foreground">{kg(value, 2)}</div>
      <div className={`num text-[12px] font-medium ${deltaClass(delta, favor)}`}>
        {delta == null
          ? "—"
          : `${delta.toLocaleString("es-ES", {
              maximumFractionDigits: 2,
              signDisplay: "always",
            })} kg`}
      </div>
    </div>
  );
}

/** Color semántico: verde en la dirección favorable, naranja en la contraria. */
function deltaClass(delta: number | null, favor: "up" | "down" | "neutral"): string {
  if (delta == null || delta === 0 || favor === "neutral") return "text-muted-foreground";
  const good = favor === "up" ? delta > 0 : delta < 0;
  return good ? "text-protein" : "text-destructive";
}

// ── Preparar visita (F-IA-7) ──
function PrepareVisitCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h2 className="text-[13px] font-semibold text-foreground">Preparar visita</h2>
      <p className="mt-1 text-[12px] text-muted-foreground">
        Análisis de tu evolución y preguntas concretas para tu nutricionista,
        ancladas a tus datos. La app observa; tu nutricionista decide.
      </p>
      <button
        type="button"
        onClick={onOpen}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px] font-medium text-foreground"
      >
        <Sparkles className="size-4 text-primary" aria-hidden />
        Preparar mi visita
      </button>
    </section>
  );
}

function VisitSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const online = useOnline();
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const r = await api.prepareVisit();
      setText(r.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar la visita.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) {
          setText(null);
          setError(null);
        }
      }}
    >
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Preparar visita al nutricionista</SheetTitle>
        </SheetHeader>
        <div className="px-4 pb-6">
          {!text && !error ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                Genera un análisis de tus últimos 21 días con datos, tu historial de
                mediciones y tu tendencia, con preguntas para la consulta.
              </p>
              <button
                type="button"
                onClick={run}
                disabled={loading || !online}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Preparando…
                  </>
                ) : !online ? (
                  <>
                    <WifiOff className="size-4" aria-hidden /> Sin conexión
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden /> Generar
                  </>
                )}
              </button>
              {!online ? (
                <p className="mt-2 text-center text-[12px] text-muted-foreground">
                  «Preparar visita» necesita conexión.
                </p>
              ) : null}
            </>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
              {error}
              <button
                type="button"
                onClick={run}
                className="mt-2 block text-[12px] font-medium underline"
              >
                Reintentar
              </button>
            </div>
          ) : null}

          {text ? (
            <Markdown
              text={text}
              className="space-y-2 text-[14px] leading-relaxed text-foreground"
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Alta / edición de medición (entrada retroactiva) ──
function MedForm({
  row,
  onClose,
  onSaved,
}: {
  row: MedMeasurement | null;
  onClose: () => void;
  onSaved: (row: MedMeasurement) => void;
}) {
  const [date, setDate] = useState(row?.date ?? dayKey());
  const [fat, setFat] = useState(row?.fatKg != null ? String(row.fatKg) : "");
  const [muscle, setMuscle] = useState(
    row?.muscleKg != null ? String(row.muscleKg) : "",
  );
  const [weight, setWeight] = useState(
    row?.weightKg != null ? String(row.weightKg) : "",
  );
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const payload = {
      date,
      fatKg: parseKg(fat),
      muscleKg: parseKg(muscle),
      weightKg: parseKg(weight),
    };
    try {
      const { med } = row
        ? await api.updateMed(row.id, payload)
        : await api.addMed(payload);
      toast.success(row ? "Medición actualizada." : "Medición añadida.");
      onSaved({
        id: med.id,
        date: med.date,
        fatKg: med.fatKg,
        muscleKg: med.muscleKg,
        weightKg: med.weightKg,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader className="pb-2">
          <SheetTitle>{row ? "Editar medición" : "Nueva medición"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-3 px-4 pb-6">
          <label className="block">
            <span className="mb-1 block text-[12px] text-muted-foreground">
              Fecha (libre — entrada retroactiva)
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="num h-11 w-full rounded-lg border border-input bg-surface px-2.5 text-base outline-none focus-visible:border-ring"
              aria-label="Fecha de la medición"
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Grasa (kg)">
              <Stepper value={fat} onChange={setFat} step={0.1} suffix="kg" ariaLabel="Grasa kg" />
            </Field>
            <Field label="Músculo (kg)">
              <Stepper value={muscle} onChange={setMuscle} step={0.1} suffix="kg" ariaLabel="Músculo kg" />
            </Field>
            <Field label="Peso (kg)">
              <Stepper value={weight} onChange={setWeight} step={0.1} suffix="kg" ariaLabel="Peso kg" />
            </Field>
          </div>
          <p className="text-[12px] text-muted-foreground">
            Deja en blanco lo que la MED no traiga. Las diferencias vs la anterior se
            calculan solas (actual − anterior).
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {row ? "Guardar" : "Añadir"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
