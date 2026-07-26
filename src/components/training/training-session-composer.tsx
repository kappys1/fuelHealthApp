"use client";

import { Dumbbell, Sparkles } from "lucide-react";
import { useState } from "react";
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

type ComposerMode = "choose" | "manual";

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
  onWodRequested,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  existingName?: string | null;
  onSaved: () => void | Promise<void>;
  /** Fase 3 conecta esta puerta con F-IA-5 sin duplicar el flujo manual. */
  onWodRequested?: () => void;
}) {
  const [mode, setMode] = useState<ComposerMode>("choose");
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState<TrainingTipo>("mixto");
  const [contenido, setContenido] = useState("");
  const [duracion, setDuracion] = useState("");
  const [kcalMin, setKcalMin] = useState("");
  const [kcalMax, setKcalMax] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setMode("choose");
    setNombre("");
    setTipo("mixto");
    setContenido("");
    setDuracion("");
    setKcalMin("");
    setKcalMax("");
  };

  const setOpen = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const save = async () => {
    if (!nombre.trim()) {
      toast.error("La sesión necesita nombre.");
      return;
    }
    setBusy(true);
    try {
      const result = await api.saveCanonicalTrainingSession(date, {
        nombre: nombre.trim(),
        tipo,
        contenido,
        duracionMin: intOrNull(duracion),
        kcalMin: intOrNull(kcalMin),
        kcalMax: intOrNull(kcalMax),
      });
      await onSaved();
      setOpen(false);
      toast.success(
        result.kind === "updated"
          ? "Sesión actualizada"
          : "Sesión guardada",
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
            {mode === "choose" ? "Añadir sesión" : "Sesión manual"}
          </SheetTitle>
          <SheetDescription>
            {labelForKey(date)}
            {existingName ? ` · sustituirá «${existingName}»` : ""}
          </SheetDescription>
        </SheetHeader>

        {mode === "choose" ? (
          <div className="grid gap-3 px-4 pb-6">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onWodRequested?.();
              }}
              disabled={!onWodRequested}
              className="wellness-panel flex min-h-[82px] items-center gap-3 p-4 text-left disabled:opacity-45"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                <Sparkles className="size-5" aria-hidden />
              </span>
              <span>
                <strong className="block text-[14px] font-semibold text-foreground">
                  Pegar WOD · IA
                </strong>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Analizar una sesión pegada y revisar antes de guardar
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="wellness-panel flex min-h-[82px] items-center gap-3 p-4 text-left"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-protein/10 text-protein">
                <Dumbbell className="size-5" aria-hidden />
              </span>
              <span>
                <strong className="block text-[14px] font-semibold text-foreground">
                  Manual
                </strong>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  Nombre, tipo, contenido, duración y rango de kcal
                </span>
              </span>
            </button>
          </div>
        ) : (
          <div className="space-y-4 px-4 pb-6">
            <label className="block">
              <span className="ui-label mb-1.5 block">Nombre</span>
              <input
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                className="min-h-11 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
                autoFocus
              />
            </label>
            <label className="block">
              <span className="ui-label mb-1.5 block">Tipo</span>
              <Select
                value={tipo}
                onValueChange={(value) => setTipo(value as TrainingTipo)}
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
                value={contenido}
                onChange={(event) => setContenido(event.target.value)}
                rows={7}
                className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
              />
            </label>
            <div className="grid grid-cols-1 gap-3 min-[380px]:grid-cols-3">
              <NumberInput
                label="Duración"
                suffix="min"
                value={duracion}
                onChange={setDuracion}
              />
              <NumberInput
                label="Kcal mín."
                suffix="kcal"
                value={kcalMin}
                onChange={setKcalMin}
              />
              <NumberInput
                label="Kcal máx."
                suffix="kcal"
                value={kcalMax}
                onChange={setKcalMax}
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-2 pt-1">
              <button
                type="button"
                onClick={() => setMode("choose")}
                className="min-h-12 rounded-xl px-4 text-[13px] font-semibold text-muted-foreground"
              >
                Atrás
              </button>
              <button
                type="button"
                onClick={save}
                disabled={busy}
                className="min-h-12 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
              >
                {busy ? "Guardando…" : "Guardar sesión"}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
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
