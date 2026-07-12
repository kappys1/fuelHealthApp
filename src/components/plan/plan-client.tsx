"use client";

import { Loader2, Pencil, Plus, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { api } from "@/lib/client-api";
import {
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
import { TrainingImport } from "./training-import";

const n = (s: string) => (s === "" ? 0 : Number(s.replace(",", ".")));

export function PlanClient({
  targets,
  derived,
  optionsByMeal,
}: {
  targets: EffectiveTargets;
  derived: DerivedTargets;
  optionsByMeal: Record<string, PlanOptionDTO[]>;
}) {
  const router = useRouter();
  const [kcal, setKcal] = useState(String(targets.kcal));
  const [prot, setProt] = useState(String(targets.prot));
  const [carb, setCarb] = useState(String(targets.carb));
  const [fat, setFat] = useState(String(targets.fat));
  const [saving, setSaving] = useState(false);
  const [addingMeal, setAddingMeal] = useState<MealKey | null>(null);

  const derive = () => {
    setCarb(String(displayMacro(derived.carb)));
    setFat(String(displayMacro(derived.fat)));
    toast("Carb/grasa rellenados desde el plan. Revisa y guarda.");
  };

  const saveTargets = async () => {
    setSaving(true);
    try {
      await api.patchTargets({
        kcal: Math.round(n(kcal)),
        prot: n(prot),
        carb: n(carb),
        fat: n(fat),
      });
      toast.success("Objetivos guardados (nueva versión de dieta).");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5 pb-8">
      <h1 className="card-title text-muted-foreground">Plan</h1>

      {/* Importar dieta (F-IA-9) y semana de entreno (F-IA-10), destacados arriba */}
      <DietImport />
      <TrainingImport />

      {/* Objetivos */}
      <section className="rounded-xl border border-line bg-surface p-4">
        <h2 className="mb-3 text-[13px] font-semibold text-foreground">
          Objetivos diarios
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="kcal (nutri)">
            <Stepper value={kcal} onChange={setKcal} step={10} ariaLabel="kcal" />
          </Field>
          <Field label="Proteína (nutri)">
            <Stepper value={prot} onChange={setProt} step={5} suffix="g" ariaLabel="Proteína" />
          </Field>
          <Field label="Hidratos">
            <Stepper value={carb} onChange={setCarb} step={5} suffix="g" ariaLabel="Hidratos" />
          </Field>
          <Field label="Grasa">
            <Stepper value={fat} onChange={setFat} step={5} suffix="g" ariaLabel="Grasa" />
          </Field>
        </div>

        <button
          type="button"
          onClick={derive}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-2 text-[13px]"
        >
          <Wand2 className="size-4 text-primary" aria-hidden />
          Derivar carb/grasa del plan
        </button>
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Día pautado medio:{" "}
          <span className="num">{Math.round(derived.kcal).toLocaleString("es-ES")}</span>{" "}
          kcal · rango{" "}
          <span className="num">{derived.kmin.toLocaleString("es-ES")}</span>–
          <span className="num">{derived.kmax.toLocaleString("es-ES")}</span>. Carb/grasa
          derivados: <span className="num">{displayMacro(derived.carb)}</span> /{" "}
          <span className="num">{displayMacro(derived.fat)}</span> g.
        </p>

        <button
          type="button"
          onClick={saveTargets}
          disabled={saving}
          className="mt-3 w-full rounded-xl bg-primary py-3 text-[15px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar objetivos"}
        </button>
      </section>

      {/* Opciones del plan */}
      <section className="space-y-4">
        <h2 className="text-[13px] font-semibold text-foreground">Opciones del plan</h2>
        {MEAL_ORDER.filter((m) => m !== "extra").map((meal) => (
          <div key={meal} className="rounded-xl border border-line bg-surface">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <h3 className="text-[13px] font-semibold text-foreground">
                {MEAL_LABELS[meal]}
              </h3>
              <button
                type="button"
                aria-label={`Añadir opción a ${MEAL_LABELS[meal]}`}
                onClick={() => setAddingMeal(addingMeal === meal ? null : meal)}
                className="inline-flex size-7 items-center justify-center rounded-lg border border-line bg-surface-2 text-primary"
              >
                <Plus className="size-4" aria-hidden />
              </button>
            </div>

            <div className="divide-y divide-line">
              {(optionsByMeal[meal] ?? []).map((o) => (
                <OptionRow key={o.id} option={o} onChanged={() => router.refresh()} />
              ))}
              {addingMeal === meal ? (
                <OptionForm
                  meal={meal}
                  onDone={() => {
                    setAddingMeal(null);
                    router.refresh();
                  }}
                  onCancel={() => setAddingMeal(null)}
                />
              ) : null}
              {(optionsByMeal[meal] ?? []).length === 0 && addingMeal !== meal ? (
                <p className="px-4 py-3 text-[12px] text-muted-foreground">
                  Sin opciones. Usa «+» para añadir.
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </section>
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

  const del = async () => {
    if (!window.confirm(`¿Borrar la opción «${option.name}»?`)) return;
    try {
      await api.deleteOption(option.id);
      toast.success("Opción borrada.");
      onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
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
    <div className="flex items-center gap-2 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px]">{option.name}</div>
        <div className="num text-[12px] text-muted-foreground">
          {option.grp}
          {option.baseG != null ? ` · ${option.baseG} g` : ""} · {option.kcal} kcal ·{" "}
          {displayMacro(option.prot)}P/{displayMacro(option.carb)}C/{displayMacro(option.fat)}F
        </div>
      </div>
      <button
        type="button"
        aria-label="Editar opción"
        onClick={() => setEditing(true)}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        aria-label="Borrar opción"
        onClick={del}
        className="shrink-0 text-muted-foreground hover:text-destructive"
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </div>
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
    const payload = {
      meal,
      grp,
      name: name.trim(),
      baseG: baseG === "" ? null : Math.round(n(baseG)),
      kcal: Math.round(n(kcal)),
      prot: n(prot),
      carb: n(carb),
      fat: n(fat),
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
      <button
        type="button"
        onClick={estimate}
        disabled={estimating}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] disabled:opacity-60"
      >
        {estimating ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4 text-primary" aria-hidden />
        )}
        Estimar macros y grupo con IA
      </button>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-[12px] text-muted-foreground">Grupo</span>
          <Select value={grp} onValueChange={(v) => setGrp(v as GrpKey)}>
            <SelectTrigger className="h-10 w-full">
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
      <div className="grid grid-cols-4 gap-2">
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
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
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
