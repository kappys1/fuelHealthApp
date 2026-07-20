"use client";

import {
  Apple,
  Calculator,
  ChevronDown,
  CircleEllipsis,
  Loader2,
  MoonStar,
  Pencil,
  Plus,
  Sparkles,
  Sunrise,
  Trash2,
  Utensils,
  Wand2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client-api";
import { labelForKey } from "@/lib/dates";
import {
  deriveVariantsForStore,
  displayMacro,
  GRP_ORDER,
  type GrpKey,
  type MealKey,
  MEAL_LABELS,
  MEAL_ORDER,
} from "@/lib/macros";
import { cn } from "@/lib/utils";
import type { DerivedTargets } from "@/server/analytics/planDerived";
import type { EffectiveTargets, PlanOptionDTO } from "@/server/db/queries/plan";
import { DietImport } from "./diet-import";
import {
  newVariantRow,
  planVariantToRow,
  type VariantRow,
  VariantsEditor,
} from "./variants-editor";

const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));

const MEAL_ICONS = {
  almuerzo: Sunrise,
  comida: Utensils,
  merienda: Apple,
  cena: MoonStar,
  extra: CircleEllipsis,
} as const;

const MEAL_COLORS = {
  almuerzo: "var(--carb)",
  comida: "var(--primary)",
  merienda: "var(--protein)",
  cena: "var(--phase)",
  extra: "var(--muted-text)",
} as const;

export function PlanClient({
  targets,
  derived,
  optionsByMeal,
  effectiveFrom,
}: {
  targets: EffectiveTargets | null;
  derived: DerivedTargets | null;
  optionsByMeal: Record<string, PlanOptionDTO[]>;
  effectiveFrom: string | null;
}) {
  const router = useRouter();
  const [kcal, setKcal] = useState(String(targets?.kcal ?? ""));
  const [prot, setProt] = useState(String(targets?.prot ?? ""));
  const [carb, setCarb] = useState(String(targets?.carb ?? ""));
  const [fat, setFat] = useState(String(targets?.fat ?? ""));
  const [saving, setSaving] = useState(false);
  const [addingMeal, setAddingMeal] = useState<MealKey | null>(null);
  const [openMeal, setOpenMeal] = useState<MealKey | null>(null);
  const [editingTargets, setEditingTargets] = useState(false);

  const derive = () => {
    if (!derived) return;
    setCarb(String(displayMacro(derived.carb)));
    setFat(String(displayMacro(derived.fat)));
    toast("Carb/grasa rellenados desde el plan. Revisa y guarda.");
  };

  const saveTargets = async () => {
    if (!targets) return;
    setSaving(true);
    try {
      await api.patchTargets({
        kcal: Math.round(n(kcal)),
        prot: n(prot),
        carb: n(carb),
        fat: n(fat),
      });
      toast.success("Objetivos guardados (nueva versión de dieta).");
      setEditingTargets(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const visibleMeals: MealKey[] = [];
  for (const meal of MEAL_ORDER) {
    if (meal !== "extra" || (optionsByMeal.extra?.length ?? 0) > 0) {
      visibleMeals.push(meal);
    }
  }

  return (
    <div className="space-y-7">
      <DietImport />

      {targets && derived ? (
        <section className="wellness-card overflow-hidden" aria-labelledby="daily-target-title">
          <div className="p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="daily-target-title"
                  className="num text-[28px] font-semibold leading-none text-foreground"
                >
                  {targets.kcal.toLocaleString("es-ES")} kcal
                </h2>
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Objetivo diario del nutricionista
                </p>
              </div>
              <button
                type="button"
                className="app-icon-button shrink-0"
                aria-label={editingTargets ? "Cerrar edición de objetivos" : "Editar objetivos"}
                aria-expanded={editingTargets}
                onClick={() => setEditingTargets((value) => !value)}
              >
                {editingTargets ? (
                  <ChevronDown className="size-5" aria-hidden />
                ) : (
                  <Pencil className="size-[18px]" aria-hidden />
                )}
              </button>
            </div>

            {effectiveFrom ? (
              <span className="mt-4 inline-flex min-h-7 items-center rounded-full bg-surface-2 px-3 text-[11px] font-semibold text-muted-foreground">
                Vigente desde {labelForKey(effectiveFrom)}
              </span>
            ) : null}

            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4">
              <MacroTarget label="Proteína" value={targets.prot} color="var(--protein)" />
              <MacroTarget
                label={`Hidratos${targets.carbDerived ? " · derivados" : ""}`}
                value={targets.carb}
                color="var(--carb)"
              />
              <MacroTarget
                label={`Grasa${targets.fatDerived ? " · derivada" : ""}`}
                value={targets.fat}
                color="var(--fat)"
              />
            </div>

            <div className="wellness-panel mt-4 flex items-start gap-3 p-3.5">
              <Calculator className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                Día pautado medio{" "}
                <span className="num font-semibold text-foreground">
                  {Math.round(derived.kcal).toLocaleString("es-ES")} kcal
                </span>{" "}
                · rango real de opciones{" "}
                <span className="num font-semibold text-foreground">
                  {derived.kmin.toLocaleString("es-ES")}–
                  {derived.kmax.toLocaleString("es-ES")} kcal
                </span>
                .
              </p>
            </div>
          </div>

          {editingTargets ? (
            <div className="space-y-4 border-t border-line bg-surface-2/55 p-5">
              <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-2">
                <Field label="kcal (nutri)">
                  <Stepper value={kcal} onChange={setKcal} step={10} ariaLabel="kcal" />
                </Field>
                <Field label="Proteína (nutri)">
                  <Stepper
                    value={prot}
                    onChange={setProt}
                    step={5}
                    suffix="g"
                    ariaLabel="Proteína"
                  />
                </Field>
                <Field label="Hidratos">
                  <Stepper
                    value={carb}
                    onChange={setCarb}
                    step={5}
                    suffix="g"
                    ariaLabel="Hidratos"
                  />
                </Field>
                <Field label="Grasa">
                  <Stepper
                    value={fat}
                    onChange={setFat}
                    step={5}
                    suffix="g"
                    ariaLabel="Grasa"
                  />
                </Field>
              </div>
              <button
                type="button"
                onClick={derive}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold text-foreground"
              >
                <Wand2 className="size-4 text-primary" aria-hidden />
                Derivar hidratos y grasa del plan
              </button>
              <button
                type="button"
                onClick={saveTargets}
                disabled={saving}
                className="min-h-11 w-full rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {saving ? "Guardando…" : "Guardar objetivos"}
              </button>
            </div>
          ) : null}
        </section>
      ) : (
        <section className="wellness-card p-5 text-center">
          <p className="text-[14px] font-semibold text-foreground">
            Todavía no hay una dieta activa
          </p>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Importa tu pauta para crear la primera versión y sus objetivos.
          </p>
        </section>
      )}

      {targets ? (
        <section className="space-y-3">
          <div>
            <h2 className="section-title">Estructura del día</h2>
            <p className="section-copy">
              Abre una comida para gestionar sus opciones y variantes
            </p>
          </div>
          {visibleMeals.map((meal) => (
            <MealPlanSection
              key={meal}
              meal={meal}
              options={optionsByMeal[meal] ?? []}
              open={openMeal === meal || addingMeal === meal}
              adding={addingMeal === meal}
              onToggle={() => setOpenMeal((value) => (value === meal ? null : meal))}
              onAdd={() => {
                setOpenMeal(meal);
                setAddingMeal(addingMeal === meal ? null : meal);
              }}
              onChanged={() => router.refresh()}
              onAdded={() => {
                setAddingMeal(null);
                router.refresh();
              }}
              onCancelAdd={() => setAddingMeal(null)}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function MacroTarget({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="min-w-0">
      <span className="block min-h-8 text-[11px] leading-tight text-muted-foreground">
        {label}
      </span>
      <strong className="num mt-1 block text-[17px] font-semibold" style={{ color }}>
        {displayMacro(value)} g
      </strong>
    </div>
  );
}

function MealPlanSection({
  meal,
  options,
  open,
  adding,
  onToggle,
  onAdd,
  onChanged,
  onAdded,
  onCancelAdd,
}: {
  meal: MealKey;
  options: PlanOptionDTO[];
  open: boolean;
  adding: boolean;
  onToggle: () => void;
  onAdd: () => void;
  onChanged: () => void;
  onAdded: () => void;
  onCancelAdd: () => void;
}) {
  const Icon = MEAL_ICONS[meal];
  const groups = new Set(options.map((option) => option.grp)).size;
  const color = MEAL_COLORS[meal];

  return (
    <div className="wellness-card overflow-hidden">
      <div className="flex min-h-[76px] items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 12%, transparent)`,
            }}
          >
            <Icon className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-foreground">
              {MEAL_LABELS[meal]}
            </span>
            <span className="mt-0.5 block text-[12px] text-muted-foreground">
              {options.length === 0
                ? "Sin opciones"
                : `${options.length} ${options.length === 1 ? "opción" : "opciones"}${groups > 1 ? ` · ${groups} grupos` : ""}`}
            </span>
          </span>
          <ChevronDown
            className={`size-[18px] shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>
        <button
          type="button"
          aria-label={`Añadir opción a ${MEAL_LABELS[meal]}`}
          onClick={onAdd}
          className="app-icon-button shrink-0 border-0 bg-surface-2 text-primary"
        >
          <Plus className="size-5" aria-hidden />
        </button>
      </div>

      {open ? (
        <div className="divide-y divide-line border-t border-line">
          {options.map((option) => (
            <OptionRow key={option.id} option={option} onChanged={onChanged} />
          ))}
          {adding ? (
            <OptionForm meal={meal} onDone={onAdded} onCancel={onCancelAdd} />
          ) : null}
          {options.length === 0 && !adding ? (
            <p className="px-5 py-4 text-[12px] text-muted-foreground">
              No hay opciones guardadas en esta comida.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function OptionRow({
  option,
  onChanged,
}: {
  option: PlanOptionDTO;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const del = async () => {
    setDeleting(true);
    try {
      await api.deleteOption(option.id);
      toast.success("Opción borrada.");
      setDeleteOpen(false);
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  };

  if (editing) {
    return (
      <OptionForm
        meal={option.meal}
        option={option}
        onDone={() => {
          setEditing(false);
          onChanged();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <>
      <div className="flex items-center gap-1 px-4 py-3">
        <div className="min-w-0 flex-1 py-1">
          <div className="truncate text-[14px] font-medium text-foreground">{option.name}</div>
          <div className="num mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
            {option.grp}
            {option.baseG != null ? ` · ${option.baseG} g` : ""} · {option.kcal} kcal ·{" "}
            {displayMacro(option.prot)}P/{displayMacro(option.carb)}C/{displayMacro(option.fat)}F
          </div>
          {option.variants.length > 0 ? (
            <div className="mt-1 text-[11px] text-primary">
              {option.variants.length} variantes · {option.variants.map((variant) => variant.nombre).join(" · ")}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          aria-label="Editar opción"
          onClick={() => setEditing(true)}
          className="app-icon-button shrink-0 border-0 bg-transparent"
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          aria-label="Borrar opción"
          onClick={() => setDeleteOpen(true)}
          className="app-icon-button shrink-0 border-0 bg-transparent hover:text-destructive"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Borrar opción del plan"
        description={`«${option.name}» dejará de estar disponible en la pauta vigente. Las comidas registradas en días anteriores no cambian.`}
        confirmLabel="Borrar opción"
        busy={deleting}
        onConfirm={del}
      />
    </>
  );
}

function OptionForm({
  meal,
  option,
  onDone,
  onCancel,
}: {
  meal: MealKey;
  option?: PlanOptionDTO;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(option?.name ?? "");
  const [grp, setGrp] = useState<GrpKey>((option?.grp as GrpKey) ?? "Opción única");
  const [baseG, setBaseG] = useState(option?.baseG != null ? String(option.baseG) : "");
  const [kcal, setKcal] = useState(String(option?.kcal ?? ""));
  const [prot, setProt] = useState(String(option?.prot ?? ""));
  const [carb, setCarb] = useState(String(option?.carb ?? ""));
  const [fat, setFat] = useState(String(option?.fat ?? ""));
  const [busy, setBusy] = useState(false);
  const [estimating, setEstimating] = useState(false);
  // Variantes intercambiables (F08), editables a mano (Fase 2). Se inicializan
  // desde la opción (números→strings con key estable); [] = opción normal.
  const [variants, setVariants] = useState<VariantRow[]>(() =>
    (option?.variants ?? []).map(planVariantToRow),
  );
  const hasVariants = variants.length > 0;

  // Convertir una opción normal en opción con variantes: siembra la 1ª con los
  // macros planos actuales y nombre vacío (inverso exacto de «Sin variantes»).
  const addVariants = () =>
    setVariants([{ ...newVariantRow(), kcal, prot, carb, fat }]);

  // «Sin variantes»: los campos planos toman los de la 1ª variante y se vacía la
  // lista → vuelve el editor de macros normal (baseG no se toca).
  const flatten = () => {
    const v0 = variants[0];
    if (v0) {
      setKcal(v0.kcal);
      setProt(v0.prot);
      setCarb(v0.carb);
      setFat(v0.fat);
    }
    setVariants([]);
  };

  // F-IA-3 · estima macros y grupo del alimento. El grupo solo se autocompleta
  // si el usuario lo dejó en el valor por defecto ("Opción única" = "vacío").
  const estimate = async () => {
    if (!name.trim()) {
      toast.error("Escribe primero el nombre del alimento.");
      return;
    }
    setEstimating(true);
    try {
      const r = await api.estimatePlanOption(
        name.trim(),
        baseG === "" ? null : Math.round(n(baseG)),
      );
      setKcal(String(Math.round(r.kcal)));
      setProt(String(displayMacro(r.proteina_g)));
      setCarb(String(displayMacro(r.carbohidratos_g)));
      setFat(String(displayMacro(r.grasa_g)));
      if (grp === "Opción única" && (GRP_ORDER as readonly string[]).includes(r.grupo)) {
        setGrp(r.grupo as GrpKey);
      }
      toast("Estimado con IA. Revisa y guarda.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo estimar.");
    } finally {
      setEstimating(false);
    }
  };

  const submit = async () => {
    if (!name.trim()) {
      toast.error("La opción necesita un nombre.");
      return;
    }
    setBusy(true);
    // Payload completo (F08): invariante plano = 1ª variante (o los macros planos si
    // no hay variantes). Derivación compartida con la vista previa del import; se
    // descartan variantes de nombre vacío. Editar es in-place sobre la versión
    // vigente (no versiona) y no reescribe las meal_entries ya registradas.
    const { variants: vs, flat } = deriveVariantsForStore(variants);
    const payload = {
      meal,
      grp,
      name: name.trim(),
      baseG: baseG === "" ? null : Math.round(n(baseG)),
      kcal: flat ? flat.kcal : Math.round(n(kcal)),
      prot: flat ? flat.prot : n(prot),
      carb: flat ? flat.carb : n(carb),
      fat: flat ? flat.fat : n(fat),
      variants: vs,
    };
    try {
      if (option) await api.updateOption(option.id, payload);
      else await api.addOption(payload);
      toast.success(option ? "Opción actualizada." : "Opción añadida.");
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2 bg-surface-2/50 px-4 py-3">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre de la opción"
        className="w-full rounded-lg border border-input bg-surface px-2.5 py-2 text-base outline-none focus-visible:border-ring"
        aria-label="Nombre"
      />
      {!hasVariants ? (
        <button
          type="button"
          onClick={estimate}
          disabled={estimating}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] font-semibold disabled:opacity-60"
        >
          {estimating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4 text-primary" aria-hidden />
          )}
          Estimar macros y grupo con IA
        </button>
      ) : null}
      {/* Grupo + gramos base: gramos son los PAUTADOS del hueco, comunes a todas las
          variantes (F08); editarlos NO reescala las variantes (editor manual). */}
      <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">Grupo</span>
          <Select value={grp} onValueChange={(v) => setGrp(v as GrpKey)}>
            <SelectTrigger className="h-11 w-full text-base">
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
        </label>
        <SmallField label="Gramos base (vacío = fijo)">
          <Stepper value={baseG} onChange={setBaseG} step={10} suffix="g" ariaLabel="Gramos base" />
        </SmallField>
      </div>
      {hasVariants ? (
        // Variantes (F08) editables (Fase 2): renombrar, macros, quitar, añadir y
        // «Sin variantes» (aplanar). La 1ª es el default al registrar. Mismo editor
        // que la vista previa del import.
        <VariantsEditor
          variants={variants}
          onChange={setVariants}
          onFlatten={flatten}
          baseG={baseG === "" ? null : Math.round(n(baseG))}
        />
      ) : (
        <>
          {/* 2×2: el Stepper (−/valor/+) necesita ~128px; en grid-cols-4 sobre móvil
              se recortaba y el botón + desaparecía. En 2 columnas cabe entero. */}
          <div className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2">
            <SmallField label="kcal">
              <Stepper value={kcal} onChange={setKcal} step={10} ariaLabel="kcal" />
            </SmallField>
            <SmallField label="Prot">
              <Stepper value={prot} onChange={setProt} step={1} ariaLabel="Proteína" />
            </SmallField>
            <SmallField label="Hidr">
              <Stepper value={carb} onChange={setCarb} step={1} ariaLabel="Hidratos" />
            </SmallField>
            <SmallField label="Grasa">
              <Stepper value={fat} onChange={setFat} step={1} ariaLabel="Grasa" />
            </SmallField>
          </div>
          <button
            type="button"
            onClick={addVariants}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-[12px] font-semibold text-primary"
          >
            <Plus className="size-3.5" aria-hidden /> Añadir variantes (elegir fuente al
            registrar)
          </button>
        </>
      )}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="min-h-11 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"
        >
          {option ? "Guardar" : "Añadir"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className={cn("block")}>
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
