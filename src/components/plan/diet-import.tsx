"use client";

import {
  FileUp,
  Loader2,
  Plus,
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
import { Stepper } from "@/components/ui/stepper";
import { fileToAiFile } from "@/lib/ai-files";
import { api } from "@/lib/client-api";
import { dayKey } from "@/lib/dates";
import {
  displayMacro,
  GRP_ORDER,
  type GrpKey,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
  type PlanVariant,
} from "@/lib/macros";
import { useOnline } from "@/lib/use-online";
import type { DietImportResult } from "@/server/ai/schemas";

const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));
const MAX_FILES = 4;

interface Row {
  key: string;
  meal: MealKey;
  grp: GrpKey;
  name: string;
  baseG: string;
  kcal: string;
  prot: string;
  carb: string;
  fat: string;
  // Variantes intercambiables (F08). [] = opción normal. En Fase 1 se cargan del
  // import y se guardan tal cual (solo lectura en la vista previa); los campos
  // planos de arriba = 1ª variante (default). Editar variantes a mano = Fase 2.
  variants: PlanVariant[];
}

let rowSeq = 0;
const rowKey = () => `r${rowSeq++}`;

/** Normaliza el nombre de comida de la pauta a nuestras claves fijas. */
function toMeal(s: string): MealKey {
  const t = s.toLowerCase();
  if (t.includes("desayuno") || t.includes("almuerzo") || t.includes("mañana"))
    return "almuerzo";
  if (t.includes("comida") || t.includes("almorzar")) return "comida";
  if (t.includes("merienda") || t.includes("media tarde")) return "merienda";
  if (t.includes("cena")) return "cena";
  return "extra";
}

const noAccents = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

function toGrp(s: string): GrpKey {
  const found = GRP_ORDER.find((g) => noAccents(g) === noAccents(s));
  return found ?? "Opción única";
}

export function DietImport() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-left"
      >
        <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <FileUp className="size-5" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-[14px] font-semibold text-foreground">
            Importar dieta (foto/PDF)
          </span>
          <span className="block text-[12px] text-muted-foreground">
            Reconstruye el plan completo desde tu pauta. Revisas antes de guardar.
          </span>
        </span>
      </button>
      {open ? <ImportSheet onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function ImportSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const online = useOnline();
  const fileRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [effectiveFrom, setEffectiveFrom] = useState(dayKey());
  const [kcal, setKcal] = useState("");
  const [prot, setProt] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);

  const pick = (list: FileList | null) => {
    if (!list) return;
    setFiles(Array.from(list).slice(0, MAX_FILES));
  };

  const analyze = async () => {
    if (files.length === 0) {
      toast.error("Elige una foto o PDF de tu pauta.");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const payload = await Promise.all(files.map(fileToAiFile));
      const result: DietImportResult = await api.importDiet(payload);
      applyResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar.");
    } finally {
      setAnalyzing(false);
    }
  };

  const applyResult = (r: DietImportResult) => {
    if (r.kcal_totales != null) setKcal(String(Math.round(r.kcal_totales)));
    if (r.proteina_total != null) setProt(String(Math.round(r.proteina_total)));
    const next: Row[] = [];
    for (const comida of r.comidas) {
      const meal = toMeal(comida.comida);
      for (const o of comida.opciones) {
        // Variantes (F08): macros a los MISMOS gramos pautados de la opción.
        const variants: PlanVariant[] = o.variantes.map((v) => ({
          nombre: v.nombre,
          kcal: Math.round(v.kcal),
          prot: v.proteina_g,
          carb: v.carbohidratos_g,
          fat: v.grasa_g,
        }));
        // Con variantes, los campos planos = la 1ª (el default que ve el editor y
        // que valen las filas sin variantes). Sin variantes, los de la opción.
        const flat = variants[0] ?? {
          kcal: Math.round(o.kcal),
          prot: o.proteina_g,
          carb: o.carbohidratos_g,
          fat: o.grasa_g,
        };
        next.push({
          key: rowKey(),
          meal,
          grp: toGrp(o.grupo),
          name: o.nombre,
          baseG: o.gramos != null ? String(Math.round(o.gramos)) : "",
          kcal: String(Math.round(flat.kcal)),
          prot: String(displayMacro(flat.prot)),
          carb: String(displayMacro(flat.carb)),
          fat: String(displayMacro(flat.fat)),
          variants,
        });
      }
    }
    setRows(next);
    if (next.length === 0) {
      toast.error("No se detectaron opciones. Prueba con una foto más nítida.");
    }
  };

  const patchRow = (key: string, patch: Partial<Row>) =>
    setRows((rs) => rs?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? null);
  const removeRow = (key: string) =>
    setRows((rs) => rs?.filter((r) => r.key !== key) ?? null);
  const addRow = (meal: MealKey) =>
    setRows((rs) => [
      ...(rs ?? []),
      {
        key: rowKey(),
        meal,
        grp: "Opción única",
        name: "",
        baseG: "",
        kcal: "",
        prot: "",
        carb: "",
        fat: "",
        variants: [],
      },
    ]);

  const save = async () => {
    if (!rows) return;
    const valid = rows.filter((r) => r.name.trim() !== "");
    if (valid.length === 0) {
      toast.error("La versión necesita al menos una opción con nombre.");
      return;
    }
    if (n(kcal) <= 0 || n(prot) <= 0) {
      toast.error("Revisa las kcal y la proteína totales.");
      return;
    }
    setSaving(true);
    try {
      await api.createDietVersion({
        effectiveFrom,
        kcal: Math.round(n(kcal)),
        prot: n(prot),
        carb: null,
        fat: null,
        options: valid.map((r) => {
          // Invariante F08: con variantes, los campos planos = la 1ª (el default).
          const v0 = r.variants[0];
          return {
            meal: r.meal,
            grp: r.grp,
            name: r.name.trim(),
            baseG: r.baseG === "" ? null : Math.round(n(r.baseG)),
            kcal: v0 ? Math.round(v0.kcal) : Math.round(n(r.kcal)),
            prot: v0 ? v0.prot : n(r.prot),
            carb: v0 ? v0.carb : n(r.carb),
            fat: v0 ? v0.fat : n(r.fat),
            variants: r.variants,
          };
        }),
      });
      toast.success("Nueva versión de dieta creada.");
      router.refresh();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la versión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle>Importar dieta (foto/PDF)</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-8">
          {/* Selección de archivos */}
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
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-surface-2 py-4 text-[14px] text-foreground"
            >
              <Upload className="size-4 text-primary" aria-hidden />
              {files.length > 0
                ? `${files.length} archivo${files.length > 1 ? "s" : ""} · cambiar`
                : "Elegir foto(s) o PDF"}
            </button>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Hasta {MAX_FILES} páginas. Nada se guarda hasta que confirmes.
            </p>
          </div>

          {rows == null ? (
            <>
              <button
                type="button"
                onClick={analyze}
                disabled={analyzing || files.length === 0 || !online}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando la
                    pauta…
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
              {/* Objetivos detectados */}
              <section className="rounded-xl border border-line bg-surface p-3">
                <h3 className="mb-2 text-[12px] font-semibold text-muted-foreground">
                  Objetivos pautados (detectados)
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  <Field label="kcal">
                    <Stepper value={kcal} onChange={setKcal} step={10} ariaLabel="kcal totales" />
                  </Field>
                  <Field label="Proteína">
                    <Stepper value={prot} onChange={setProt} step={5} suffix="g" ariaLabel="Proteína total" />
                  </Field>
                  <Field label="Vigente desde">
                    <input
                      type="date"
                      value={effectiveFrom}
                      onChange={(e) => setEffectiveFrom(e.target.value)}
                      className="num h-11 w-full rounded-lg border border-input bg-surface px-2 text-[13px] outline-none focus-visible:border-ring"
                      aria-label="Vigente desde"
                    />
                  </Field>
                </div>
              </section>

              {/* Opciones por comida (editable) */}
              {MEAL_ORDER.map((meal) => {
                const mealRows = rows.filter((r) => r.meal === meal);
                if (meal === "extra" && mealRows.length === 0) return null;
                return (
                  <section key={meal} className="rounded-xl border border-line bg-surface">
                    <div className="flex items-center justify-between border-b border-line px-3 py-2">
                      <h3 className="text-[13px] font-semibold text-foreground">
                        {MEAL_LABELS[meal]}
                      </h3>
                      <button
                        type="button"
                        onClick={() => addRow(meal)}
                        aria-label={`Añadir opción a ${MEAL_LABELS[meal]}`}
                        className="inline-flex size-6 items-center justify-center rounded-md border border-line bg-surface-2 text-primary"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </button>
                    </div>
                    <div className="divide-y divide-line">
                      {mealRows.length === 0 ? (
                        <p className="px-3 py-2 text-[12px] text-muted-foreground">
                          Sin opciones.
                        </p>
                      ) : (
                        mealRows.map((r) => (
                          <RowEditor
                            key={r.key}
                            row={r}
                            onPatch={(p) => patchRow(r.key, p)}
                            onRemove={() => removeRow(r.key)}
                          />
                        ))
                      )}
                    </div>
                  </section>
                );
              })}

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Creando…" : "Crear versión de dieta"}
              </button>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function RowEditor({
  row,
  onPatch,
  onRemove,
}: {
  row: Row;
  onPatch: (p: Partial<Row>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-2 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <input
          value={row.name}
          onChange={(e) => onPatch({ name: e.target.value })}
          placeholder="Nombre de la opción"
          className="min-w-0 flex-1 rounded-lg border border-input bg-surface px-2.5 py-2 text-[14px] outline-none focus-visible:border-ring"
          aria-label="Nombre"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label="Quitar opción"
          className="shrink-0 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Select value={row.grp} onValueChange={(v) => onPatch({ grp: v as GrpKey })}>
          <SelectTrigger className="h-9 w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRP_ORDER.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MiniInput label="g" value={row.baseG} onChange={(v) => onPatch({ baseG: v })} />
      </div>
      {row.variants.length > 0 ? (
        // Variantes (F08): en Fase 1 son solo lectura (editarlas a mano = Fase 2).
        // Las macros mostradas son las de la 1ª variante (el default al registrar).
        <div className="rounded-lg border border-primary/25 bg-primary/5 px-2.5 py-2">
          <p className="text-[11px] font-medium text-primary">
            {row.variants.length} variantes · eliges la fuente al registrar
          </p>
          <p className="mt-0.5 text-[12px] text-foreground">
            {row.variants.map((v) => v.nombre).join(" · ")}
          </p>
          <p className="num mt-1 text-[11px] text-muted-foreground">
            {row.kcal} kcal · {row.prot}P/{row.carb}C/{row.fat}F ({row.variants[0]?.nombre})
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <MiniInput label="kcal" value={row.kcal} onChange={(v) => onPatch({ kcal: v })} />
          <MiniInput label="P" value={row.prot} onChange={(v) => onPatch({ prot: v })} />
          <MiniInput label="C" value={row.carb} onChange={(v) => onPatch({ carb: v })} />
          <MiniInput label="F" value={row.fat} onChange={(v) => onPatch({ fat: v })} />
        </div>
      )}
    </div>
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
    <label className="flex items-center gap-1 rounded-lg border border-input bg-surface px-2">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <input
        value={value}
        inputMode="decimal"
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "" || /^[0-9]*[.,]?[0-9]*$/.test(raw)) onChange(raw);
        }}
        onFocus={(e) => e.currentTarget.select()}
        className="num h-9 w-full min-w-0 bg-transparent text-center text-base outline-none"
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
