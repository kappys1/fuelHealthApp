"use client";

import {
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  Ruler,
  Sparkles,
  Trash2,
  WifiOff,
} from "lucide-react";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
  const [detailId, setDetailId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<MedMeasurement | null>(null);
  const [deleting, setDeleting] = useState(false);

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
    setDeleting(true);
    const prev = rows;
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    try {
      await api.deleteMed(row.id);
      toast.success("Medición borrada.");
      setDetailId(null);
      setPendingDelete(null);
    } catch (err) {
      setRows(prev);
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  };
  const detail = desc.find((row) => row.id === detailId) ?? null;

  return (
    <div className="space-y-7">
      <div>
        <h2 className="app-section-title">Mediciones MED</h2>
        <p className="section-copy">Compara siempre mediciones del mismo método</p>
      </div>
      {/* Preparar visita (F-IA-7) */}
      <PrepareVisitCard onOpen={() => setVisitOpen(true)} />

      {/* Gráfico de composición doble eje */}
      <section className="wellness-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="app-section-title">Composición corporal</h2>
            <p className="section-copy">Grasa, músculo y peso medidos por tu nutricionista</p>
          </div>
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
      <section className="wellness-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Historial MED</h2>
            <p className="text-[11px] text-muted-foreground">Toca una medición para verla</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 text-[13px] font-semibold text-primary"
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
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => setDetailId(r.id)}
                  className="flex min-h-20 w-full items-center gap-3 px-5 py-4 text-left"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-special/10 text-special">
                    <Ruler className="size-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-semibold text-foreground">
                      {labelForKey(r.date)}
                    </span>
                    <span className="num mt-1 block text-[11px] text-muted-foreground">
                      {[
                        r.fatKg != null ? `Grasa ${kg(r.fatKg, 2)} kg` : null,
                        r.muscleKg != null ? `Músculo ${kg(r.muscleKg, 2)} kg` : null,
                        r.weightKg != null ? `Peso ${kg(r.weightKg, 1)} kg` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </button>
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

      {detail ? (
        <MedDetailSheet
          row={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => {
            setEditing(detail);
            setDetailId(null);
            setFormOpen(true);
          }}
          onDelete={() => setPendingDelete(detail)}
        />
      ) : null}

      <ConfirmDialog
        open={pendingDelete != null}
        onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
        title="Borrar medición"
        description={
          pendingDelete
            ? `Se borrará la medición del ${labelForKey(pendingDelete.date)}. Las diferencias posteriores se recalcularán.`
            : ""
        }
        confirmLabel="Borrar medición"
        busy={deleting}
        onConfirm={() => {
          if (pendingDelete) return del(pendingDelete);
        }}
      />
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
    <div className="rounded-xl bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="num text-[16px] font-semibold text-foreground">
        {kg(value, 2)}{value != null ? " kg" : ""}
      </div>
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

function MedDetailSheet({
  row,
  onClose,
  onEdit,
  onDelete,
}: {
  row: MedWithDelta;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Medición · {labelForKey(row.date)}</SheetTitle>
        </SheetHeader>
        <div className="space-y-5 px-4 pb-8">
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            Diferencias frente a la MED anterior. Grasa y músculo están expresados en
            kg y no se mezclan con estimaciones de báscula.
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Metric label="Grasa" value={row.fatKg} delta={row.delta.fatKg} favor="down" />
            <Metric
              label="Músculo"
              value={row.muscleKg}
              delta={row.delta.muscleKg}
              favor="up"
            />
            <Metric
              label="Peso"
              value={row.weightKg}
              delta={row.delta.weightKg}
              favor="neutral"
            />
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-line pt-4">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-[13px] font-semibold text-foreground"
            >
              <Pencil className="size-4" aria-hidden /> Editar
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 text-[13px] font-semibold text-destructive"
            >
              <Trash2 className="size-4" aria-hidden /> Borrar
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ── Preparar visita (F-IA-7) ──
function PrepareVisitCard({ onOpen }: { onOpen: () => void }) {
  return (
    <section className="wellness-card flex items-center gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
        <Sparkles className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="text-[14px] font-semibold text-foreground">Preparar visita</h2>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
          Resume 30 días y prepara preguntas para tu nutricionista.
        </p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Preparar mi visita"
        className="app-icon-button shrink-0 text-primary"
      >
        <ChevronRight className="size-[18px]" aria-hidden />
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
                Genera un análisis de tus últimos 30 días naturales, tu historial de
                mediciones y tu tendencia, con preguntas para la consulta.
              </p>
              <button
                type="button"
                onClick={run}
                disabled={loading || !online}
                className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
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
                className="mt-2 min-h-11 text-[12px] font-semibold underline"
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
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>{row ? "Editar medición" : "Nueva medición"}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
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
          <div className="space-y-3">
            <Field label="Grasa (kg)">
              <Stepper
                value={fat}
                onChange={setFat}
                step={0.1}
                suffix="kg"
                ariaLabel="Grasa kg"
                className="w-full"
              />
            </Field>
            <Field label="Músculo (kg)">
              <Stepper
                value={muscle}
                onChange={setMuscle}
                step={0.1}
                suffix="kg"
                ariaLabel="Músculo kg"
                className="w-full"
              />
            </Field>
            <Field label="Peso (kg)">
              <Stepper
                value={weight}
                onChange={setWeight}
                step={0.1}
                suffix="kg"
                ariaLabel="Peso kg"
                className="w-full"
              />
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
              className="min-h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
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
