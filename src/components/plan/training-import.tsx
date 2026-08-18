"use client";

import {
  ArrowRight,
  CalendarPlus,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fileToAiFile } from "@/lib/ai-files";
import { api } from "@/lib/client-api";
import {
  daysBetween,
  isoWeekday,
  labelForKey,
  shiftDayKey,
} from "@/lib/dates";
import {
  type TrainingFormatOutcome,
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
  TRAINING_TIPOS,
} from "@/lib/training";
import {
  changeAssignmentDate,
  overrideAssignmentFranja,
} from "@/lib/training-assignment";
import { formatNotice, formatOrKeep } from "@/lib/training-format-client";
import type {
  SessionFranja,
  TrainingByWeekday,
} from "@/lib/training-slot";
import { useOnline } from "@/lib/use-online";
import { randomUUID } from "@/lib/uuid";
import type { TrainingImportResult } from "@/server/ai/schemas";

const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));
const intOrNull = (s: string) => (s.trim() === "" ? null : Math.round(n(s)));
const MAX_FILES = 4;

const noAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function toTipo(s: string): TrainingTipo {
  const t = noAccents(s);
  const found = TRAINING_TIPOS.find((x) => x === t);
  if (found) return found;
  // Sinónimos frecuentes del modelo.
  if (t.includes("halter") || t.includes("weightlift")) return "halterofilia";
  if (t.includes("gimnas") || t.includes("gymnast")) return "gimnasticos";
  if (t.includes("metab") || t.includes("condition") || t.includes("wod"))
    return "metabolico";
  if (t.includes("aerob") || t.includes("cardio") || t.includes("carrera"))
    return "aerobico";
  if (t.includes("fuerza") || t.includes("strength")) return "fuerza";
  if (t.includes("descans") || t.includes("rest")) return "descanso";
  if (t.includes("mix") || t.includes("cross")) return "mixto";
  return "otro";
}

interface SRow {
  key: string;
  clave: string;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  kcalMin: string;
  kcalMax: string;
  duracionMin: string;
  /** Día asignado (clave 'YYYY-MM-DD') o "" si sin asignar. */
  date: string;
  franja: SessionFranja | null;
  franjaSource: "auto" | "manual";
}

let rowSeq = 0;
const rowKey = () => `t${rowSeq++}`;

/** Lunes de la semana de una clave de día. */
function mondayOf(key: string): string {
  return shiftDayKey(key, -(isoWeekday(key) - 1));
}

export function TrainingImport({
  weekStart,
  trainingByWeekday,
}: {
  weekStart: string;
  trainingByWeekday: TrainingByWeekday;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wellness-card group flex min-h-[86px] w-full items-center gap-3 border border-primary/20 p-5 text-left transition-colors hover:border-primary/40"
      >
        <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <CalendarPlus className="size-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-foreground">
            Importar semana de entreno
          </span>
          <span className="mt-1 block text-[12px] leading-relaxed text-muted-foreground">
            PDF, foto o texto de tu programación. Asignas cada sesión a un día.
          </span>
        </span>
        <ArrowRight className="size-[18px] shrink-0 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden />
      </button>
      {open ? (
        <ImportSheet
          initialWeekStart={weekStart}
          trainingByWeekday={trainingByWeekday}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}

function ImportSheet({
  initialWeekStart,
  trainingByWeekday,
  onClose,
}: {
  initialWeekStart: string;
  trainingByWeekday: TrainingByWeekday;
  onClose: () => void;
}) {
  const router = useRouter();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const requestIdRef = useRef<string | null>(null);

  const [mode, setMode] = useState<"file" | "text">("file");
  const [files, setFiles] = useState<File[]>([]);
  const [texto, setTexto] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [programa, setPrograma] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [weekStart, setWeekStart] = useState(() =>
    mondayOf(initialWeekStart),
  );
  const [rows, setRows] = useState<SRow[] | null>(null);

  const weekDates = Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i));

  const pick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).slice(0, MAX_FILES));
  };

  const analyze = async () => {
    if (mode === "file" && files.length === 0) {
      toast.error("Elige un PDF o una foto de tu programación.");
      return;
    }
    if (mode === "text" && texto.trim() === "") {
      toast.error("Pega o escribe la programación de la semana.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const payload =
        mode === "file"
          ? { files: await Promise.all(files.map(fileToAiFile)) }
          : { texto: texto.trim() };
      const result = await api.importTraining(payload);
      /*
        F25 · Fase 3: el formateo va DENTRO del análisis, no en un botón aparte.
        Una llamada por sesión, en paralelo y contra el modelo más barato; la
        vista previa editable que ya existe enseña el resultado con sus `**`
        antes de guardar. Si alguna falla, esa sesión conserva su texto y solo
        se avisa: importar no puede depender de que responda un modelo (AC 10).
      */
      const outcomes = await Promise.all(
        result.sesiones.map((s) => formatOrKeep(s.contenido)),
      );
      applyResult(result, outcomes);
      const notice = formatNotice(outcomes);
      if (notice) toast.warning(notice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar.");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyResult = (
    r: TrainingImportResult,
    outcomes?: TrainingFormatOutcome[],
  ) => {
    requestIdRef.current = randomUUID();
    if (r.programa) setPrograma(r.programa);
    if (r.etiqueta) setEtiqueta(r.etiqueta);
    const next: SRow[] = r.sesiones.map((s, i) => ({
      key: rowKey(),
      clave: s.clave,
      nombre: s.nombre,
      tipo: toTipo(s.tipo),
      contenido: outcomes?.[i]?.contenido ?? s.contenido,
      kcalMin: String(Math.round(s.kcal_min)),
      kcalMax: String(Math.round(s.kcal_max)),
      duracionMin: String(Math.round(s.duracion_min)),
      date: "",
      franja: null,
      franjaSource: "auto",
    }));
    setRows(next);
    if (next.length === 0) {
      toast.error("No se detectaron sesiones. Prueba con otro archivo o el texto.");
    }
  };

  const patchRow = (key: string, patch: Partial<SRow>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  const removeRow = (key: string) =>
    setRows((rs) => rs?.filter((r) => r.key !== key) ?? null);

  const save = async () => {
    if (!rows) return;
    const valid = rows.filter((r) => r.nombre.trim() !== "");
    if (valid.length === 0) {
      toast.error("Al menos una sesión necesita nombre.");
      return;
    }
    if (programa.trim() === "" || etiqueta.trim() === "") {
      toast.error("Pon el programa y la etiqueta (ej. «Week 29»).");
      return;
    }
    const assignedDates = valid.flatMap((row) => (row.date ? [row.date] : []));
    if (new Set(assignedDates).size !== assignedDates.length) {
      toast.error("Asigna como máximo una sesión a cada día.");
      return;
    }
    if (valid.some((row) => row.date && !row.franja)) {
      toast.error("Elige mañana o tarde en todas las sesiones asignadas.");
      return;
    }
    const source: "pdf" | "foto" | "texto" =
      mode === "text"
        ? "texto"
        : files.some((f) => /pdf/i.test(f.type))
          ? "pdf"
          : "foto";

    // assignments apuntan al índice dentro de `sessions` (== orden de `valid`).
    const assignments = valid.flatMap((r, i) =>
      r.date && r.franja
        ? [{ sessionIndex: i, date: r.date, franja: r.franja }]
        : [],
    );

    setSaving(true);
    try {
      const res = await api.createTrainingPlan({
        requestId: requestIdRef.current ?? (requestIdRef.current = randomUUID()),
        programa: programa.trim(),
        etiqueta: etiqueta.trim(),
        source,
        weekStart,
        sessions: valid.map((r) => ({
          key: r.clave.trim() || "—",
          nombre: r.nombre.trim(),
          tipo: r.tipo,
          contenido: r.contenido.trim(),
          kcalMin: intOrNull(r.kcalMin),
          kcalMax: intOrNull(r.kcalMax),
          duracionMin: intOrNull(r.duracionMin),
        })),
        assignments,
      });
      toast.success(
        `Semana creada · ${res.assigned} día(s) asignado(s)${res.skipped ? `, ${res.skipped} ya registrado(s)` : ""}.`,
      );
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la semana.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Importar semana de entreno</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Modo de entrada */}
          <div className="flex gap-2">
            {(["file", "text"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`min-h-11 flex-1 rounded-lg border px-3 text-[13px] font-medium ${
                  mode === m
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-line bg-surface-2 text-muted-foreground"
                }`}
              >
                {m === "file" ? "PDF / foto" : "Texto"}
              </button>
            ))}
          </div>

          {mode === "file" ? (
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                onChange={(e) => pick(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 px-3 text-[14px] text-foreground"
              >
                <Upload className="size-4 text-primary" aria-hidden />
                {files.length > 0
                  ? `${files.length} archivo${files.length > 1 ? "s" : ""} · cambiar`
                  : "Elegir PDF o foto(s)"}
              </button>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Hasta {MAX_FILES} páginas. Nada se guarda hasta que confirmes.
              </p>
            </div>
          ) : (
            <label className="block space-y-1.5">
              <span className="text-[12px] font-medium text-foreground">
                Programación de la semana
              </span>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder="Pega o escribe la programación de la semana (T1: … / T2: … / …)."
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
              />
            </label>
          )}

          {rows == null ? (
            <>
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || !online}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando la
                    semana…
                  </>
                ) : !online ? (
                  <>
                    <WifiOff className="size-4" aria-hidden /> Sin conexión
                  </>
                ) : (
                  <>
                    <Sparkles className="size-4" aria-hidden /> Analizar con IA
                  </>
                )}
              </button>
              {error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
                  {error}
                </div>
              ) : null}
            </>
          ) : (
            <>
              {/* Programa / etiqueta / semana */}
              <section className="grid grid-cols-1 gap-3 rounded-xl border border-line bg-surface p-3 min-[380px]:grid-cols-2">
                <Field label="Programa">
                  <TextInput value={programa} onChange={setPrograma} placeholder="The Progrm" />
                </Field>
                <Field label="Etiqueta">
                  <TextInput value={etiqueta} onChange={setEtiqueta} placeholder="Week 29" />
                </Field>
                <Field label="Semana empieza el">
                  <input
                    type="date"
                    value={weekStart}
                    onChange={(e) => {
                      if (!e.target.value) return;
                      const next = mondayOf(e.target.value);
                      const delta = daysBetween(weekStart, next);
                      setRows((current) =>
                        current?.map((row) => ({
                          ...row,
                          ...(row.date
                            ? (() => {
                                const next = changeAssignmentDate(
                                  {
                                    date: row.date,
                                    franja: row.franja,
                                    source: row.franjaSource,
                                  },
                                  shiftDayKey(row.date, delta),
                                  trainingByWeekday,
                                );
                                return {
                                  date: next.date,
                                  franja: next.franja,
                                  franjaSource: next.source,
                                };
                              })()
                            : {}),
                        })) ?? null,
                      );
                      setWeekStart(next);
                    }}
                    className="num h-11 w-full rounded-lg border border-input bg-surface px-2 text-base outline-none focus-visible:border-ring"
                    aria-label="Semana empieza el"
                  />
                </Field>
              </section>

              {/* Sesiones (editable + asignación a día) */}
              {rows.map((r) => (
                <SessionEditor
                  key={r.key}
                  row={r}
                  weekDates={weekDates}
                  trainingByWeekday={trainingByWeekday}
                  onPatch={(p) => patchRow(r.key, p)}
                  onRemove={() => removeRow(r.key)}
                />
              ))}

              <button
                type="button"
                onClick={save}
                disabled={
                  saving ||
                  rows.some((row) => row.date && !row.franja)
                }
                className="min-h-11 w-full rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Creando…" : "Crear semana de entreno"}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function SessionEditor({
  row,
  weekDates,
  trainingByWeekday,
  onPatch,
  onRemove,
}: {
  row: SRow;
  weekDates: string[];
  trainingByWeekday: TrainingByWeekday;
  onPatch: (p: Partial<SRow>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="space-y-2 rounded-xl border border-line bg-surface p-3">
      <div className="flex items-center gap-2">
        <input
          value={row.clave}
          onChange={(e) => onPatch({ clave: e.target.value })}
          placeholder="T1"
          className="min-h-11 w-14 shrink-0 rounded-lg border border-input bg-surface px-2 text-center text-base outline-none focus-visible:border-ring"
          aria-label="Clave"
        />
        <input
          value={row.nombre}
          onChange={(e) => onPatch({ nombre: e.target.value })}
          placeholder="Nombre de la sesión"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-input bg-surface px-2.5 text-base outline-none focus-visible:border-ring"
          aria-label="Nombre"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar sesión"
          className="app-icon-button shrink-0 border-0 bg-transparent hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <textarea
        value={row.contenido}
        onChange={(e) => onPatch({ contenido: e.target.value })}
        rows={2}
        placeholder="Contenido de la sesión"
        className="w-full rounded-lg border border-input bg-surface px-2.5 py-2.5 text-base outline-none focus-visible:border-ring"
        aria-label="Contenido"
      />

      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <Field label="Tipo">
          <Select value={row.tipo} onValueChange={(v) => onPatch({ tipo: v as TrainingTipo })}>
            <SelectTrigger className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRAINING_TIPOS.map((t) => (
                <SelectItem key={t} value={t}>
                  {TRAINING_TIPO_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Asignar a">
          <Select
            value={row.date || "none"}
            onValueChange={(v) => {
              const next = changeAssignmentDate(
                {
                  date: row.date,
                  franja: row.franja,
                  source: row.franjaSource,
                },
                v === "none" ? "" : v,
                trainingByWeekday,
              );
              onPatch({
                date: next.date,
                franja: next.franja,
                franjaSource: next.source,
              });
            }}
          >
            <SelectTrigger className="h-11 w-full text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin asignar</SelectItem>
              {weekDates.map((d) => (
                <SelectItem key={d} value={d}>
                  {labelForKey(d)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Franja">
          <Select
            value={row.franja ?? "none"}
            onValueChange={(value) => {
              const next = overrideAssignmentFranja(
                {
                  date: row.date,
                  franja: row.franja,
                  source: row.franjaSource,
                },
                value as SessionFranja,
              );
              onPatch({
                franja: next.franja,
                franjaSource: next.source,
              });
            }}
            disabled={!row.date}
          >
            <SelectTrigger className="h-11 w-full text-base">
              <SelectValue
                placeholder={row.date ? "Elige franja" : "Asigna un día"}
              />
            </SelectTrigger>
            <SelectContent>
              {!row.franja ? (
                <SelectItem value="none" disabled>
                  Elige mañana o tarde
                </SelectItem>
              ) : null}
              <SelectItem value="mañana">Mañana</SelectItem>
              <SelectItem value="tarde">Tarde</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-3">
        <MiniInput label="kcal mín" value={row.kcalMin} onChange={(v) => onPatch({ kcalMin: v })} />
        <MiniInput label="kcal máx" value={row.kcalMax} onChange={(v) => onPatch({ kcalMax: v })} />
        <MiniInput label="min" value={row.duracionMin} onChange={(v) => onPatch({ duracionMin: v })} />
      </div>
    </section>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-lg border border-input bg-surface px-2.5 text-base outline-none focus-visible:border-ring"
    />
  );
}

function MiniInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-1 rounded-lg border border-input bg-surface px-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" || /^[0-9]*$/.test(raw)) onChange(raw);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="num h-11 w-full min-w-0 bg-transparent text-center text-base outline-none"
        aria-label={label}
      />
    </label>
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
