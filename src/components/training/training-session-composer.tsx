"use client";

import { Dumbbell, Loader2, Sparkles } from "lucide-react";
import { useReducer, useState } from "react";
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { labelForKey } from "@/lib/dates";
import {
  TRAINING_TIPO_LABELS,
  type TrainingTipo,
  TRAINING_TIPOS,
} from "@/lib/training";

type ComposerMode = "choose" | "manual" | "wod";
interface ComposerState {
  mode: ComposerMode;
  nombre: string;
  tipo: TrainingTipo;
  contenido: string;
  duracion: string;
  kcalMin: string;
  kcalMax: string;
  wodText: string;
  wodComment: string;
  wodAnalyzed: boolean;
}
type ComposerAction =
  | { type: "patch"; patch: Partial<ComposerState> }
  | { type: "reset"; initialMode: "choose" | "wod" };

function initialState(initialMode: "choose" | "wod"): ComposerState {
  return {
    mode: initialMode,
    nombre: "",
    tipo: "mixto",
    contenido: "",
    duracion: "",
    kcalMin: "",
    kcalMax: "",
    wodText: "",
    wodComment: "",
    wodAnalyzed: false,
  };
}

function reducer(state: ComposerState, action: ComposerAction): ComposerState {
  return action.type === "reset"
    ? initialState(action.initialMode)
    : { ...state, ...action.patch };
}

function intOrNull(value: string): number | null {
  if (!value.trim()) return null;
  return Math.round(Number(value.replace(",", ".")));
}

export function TrainingSessionComposer({
  open,
  onOpenChange,
  date,
  existingName = null,
  onSaved,
  initialMode = "choose",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  existingName?: string | null;
  onSaved: () => void | Promise<void>;
  initialMode?: "choose" | "wod";
}) {
  const [state, dispatch] = useReducer(reducer, initialMode, initialState);
  const [busy, setBusy] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const patch = (next: Partial<ComposerState>) =>
    dispatch({ type: "patch", patch: next });
  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) dispatch({ type: "reset", initialMode });
  };

  const analyzeWod = async () => {
    if (!state.wodText.trim()) return;
    setAnalyzing(true);
    try {
      const result = await api.analyzeWod(state.wodText, date);
      patch({
        nombre: result.nombre,
        tipo: result.tipo,
        // El contenido canónico es el input original, no texto regenerado por IA.
        contenido: state.wodText,
        duracion: String(Math.round(result.duracion_min)),
        kcalMin: String(Math.round(result.kcal_min)),
        kcalMax: String(Math.round(result.kcal_max)),
        wodComment: result.comentario,
        wodAnalyzed: true,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo analizar el WOD.",
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!state.nombre.trim()) {
      toast.error("La sesión necesita nombre.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.saveCanonicalTrainingSession(date, {
        nombre: state.nombre.trim(),
        tipo: state.tipo,
        contenido: state.contenido,
        duracionMin: intOrNull(state.duracion),
        kcalMin: intOrNull(state.kcalMin),
        kcalMax: intOrNull(state.kcalMax),
      });
      await onSaved();
      setOpen(false);
      toast.success(
        result.kind === "updated" ? "Sesión actualizada" : "Sesión guardada",
        {
          action: {
            label: "Deshacer",
            onClick: () => {
              void api
                .undoCanonicalTrainingSession(result.undo)
                .then(async () => {
                  await onSaved();
                  toast.success("Sesión restaurada.");
                })
                .catch((error) =>
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : "No se pudo deshacer.",
                  ),
                );
            },
          },
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar la sesión.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {state.mode === "choose"
              ? "Añadir sesión"
              : state.mode === "manual"
                ? "Sesión manual"
                : "Pegar WOD · IA"}
          </SheetTitle>
          <SheetDescription>
            {labelForKey(date)}
            {existingName ? ` · sustituirá «${existingName}»` : ""}
          </SheetDescription>
        </SheetHeader>

        {state.mode === "choose" ? (
          <ChoiceStep onMode={(mode) => patch({ mode })} />
        ) : state.mode === "wod" && !state.wodAnalyzed ? (
          <WodInputStep
            value={state.wodText}
            analyzing={analyzing}
            canGoBack={initialMode !== "wod"}
            onChange={(wodText) => patch({ wodText })}
            onBack={() => patch({ mode: "choose" })}
            onAnalyze={analyzeWod}
          />
        ) : (
          <DraftStep
            state={state}
            busy={busy}
            onPatch={patch}
            onBack={() =>
              state.mode === "wod"
                ? patch({ wodAnalyzed: false })
                : patch({ mode: "choose" })
            }
            onSave={save}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function ChoiceStep({ onMode }: { onMode: (mode: "manual" | "wod") => void }) {
  return (
    <div className="grid gap-3 px-4 pb-6">
      <ChoiceButton
        title="Pegar WOD · IA"
        copy="Analizar una sesión pegada y revisar antes de guardar"
        Icon={Sparkles}
        tone="bg-primary-soft text-primary"
        onClick={() => onMode("wod")}
      />
      <ChoiceButton
        title="Manual"
        copy="Nombre, tipo, contenido, duración y rango de kcal"
        Icon={Dumbbell}
        tone="bg-protein/10 text-protein"
        onClick={() => onMode("manual")}
      />
    </div>
  );
}

function ChoiceButton({
  title,
  copy,
  Icon,
  tone,
  onClick,
}: {
  title: string;
  copy: string;
  Icon: typeof Sparkles;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="wellness-panel flex min-h-[82px] items-center gap-3 p-4 text-left"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span>
        <strong className="block text-[14px] font-semibold text-foreground">
          {title}
        </strong>
        <span className="mt-0.5 block text-[11px] text-muted-foreground">
          {copy}
        </span>
      </span>
    </button>
  );
}

function WodInputStep({
  value,
  analyzing,
  canGoBack,
  onChange,
  onBack,
  onAnalyze,
}: {
  value: string;
  analyzing: boolean;
  canGoBack: boolean;
  onChange: (value: string) => void;
  onBack: () => void;
  onAnalyze: () => void;
}) {
  return (
    <div className="space-y-4 px-4 pb-6">
      <label className="block">
        <span className="ui-label mb-1.5 block">WOD completo</span>
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={9}
          placeholder="Pega aquí fuerza, WOD, accesorios y descansos…"
          className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        La IA estima nombre, tipo, duración y rango. El texto se conserva íntegro
        y solo se analiza al tocar el botón.
      </p>
      <div className="grid grid-cols-[auto_1fr] gap-2">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="min-h-12 rounded-xl px-4 text-[13px] font-semibold text-muted-foreground disabled:invisible"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={analyzing || !value.trim()}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {analyzing ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-4" aria-hidden />
          )}
          {analyzing ? "Analizando…" : "Analizar WOD"}
        </button>
      </div>
    </div>
  );
}

function DraftStep({
  state,
  busy,
  onPatch,
  onBack,
  onSave,
}: {
  state: ComposerState;
  busy: boolean;
  onPatch: (patch: Partial<ComposerState>) => void;
  onBack: () => void;
  onSave: () => void;
}) {
  return (
    <div className="space-y-4 px-4 pb-6">
      {state.mode === "wod" ? (
        <div className="rounded-xl border border-primary/20 bg-primary-soft p-3">
          <p className="text-[12px] font-semibold text-foreground">
            Vista previa editable
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {state.wodComment}
          </p>
        </div>
      ) : null}
      <TextField
        label="Nombre"
        value={state.nombre}
        onChange={(nombre) => onPatch({ nombre })}
      />
      <label className="block">
        <span className="ui-label mb-1.5 block">Tipo</span>
        <Select
          value={state.tipo}
          onValueChange={(tipo) => onPatch({ tipo: tipo as TrainingTipo })}
        >
          <SelectTrigger className="min-h-11 w-full text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRAINING_TIPOS.map((value) => (
              <SelectItem key={value} value={value}>
                {TRAINING_TIPO_LABELS[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>
      <label className="block">
        <span className="ui-label mb-1.5 block">Contenido completo</span>
        <textarea
          value={state.contenido}
          onChange={(event) => onPatch({ contenido: event.target.value })}
          rows={7}
          className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
        <NumberInput
          label="Duración"
          suffix="min"
          value={state.duracion}
          onChange={(duracion) => onPatch({ duracion })}
        />
        <NumberInput
          label="Kcal mín."
          suffix="kcal"
          value={state.kcalMin}
          onChange={(kcalMin) => onPatch({ kcalMin })}
        />
        <NumberInput
          label="Kcal máx."
          suffix="kcal"
          value={state.kcalMax}
          onChange={(kcalMax) => onPatch({ kcalMax })}
        />
      </div>
      <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
        <button
          type="button"
          onClick={onBack}
          className="min-h-12 rounded-xl px-4 text-[13px] font-semibold text-muted-foreground"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={busy}
          className="min-h-12 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
        >
          {busy ? "Guardando…" : "Guardar sesión"}
        </button>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="ui-label mb-1.5 block">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
      />
    </label>
  );
}

function NumberInput({
  label,
  suffix,
  value,
  onChange,
}: {
  label: string;
  suffix: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="ui-label mb-1.5 block">{label}</span>
      <span className="flex min-h-11 items-center rounded-xl border border-input bg-surface px-3">
        <input
          value={value}
          inputMode="decimal"
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === "" || /^\d*[.,]?\d*$/.test(raw)) onChange(raw);
          }}
          className="num h-11 min-w-0 flex-1 bg-transparent text-base outline-none"
          aria-label={label}
        />
        <span className="text-[10px] text-muted-foreground">{suffix}</span>
      </span>
    </label>
  );
}
