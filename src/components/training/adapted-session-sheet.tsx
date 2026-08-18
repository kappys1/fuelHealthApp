"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { labelForKey } from "@/lib/dates";
import { formatOrKeep } from "@/lib/training-format-client";

/*
  F26 Fase 2 · la ÚNICA puerta de guardado de la sesión adaptada, con tres
  orígenes: el botón de la ficha del día, el Chat (Fase 3) y la edición a mano.

  No reutiliza `TrainingSessionComposer` a propósito (DECISIONS #99): aquel
  guarda en `training_sessions`, que es justo lo que F26 prohíbe tocar, y pide
  nombre, tipo, duración, kcal y franja — campos que la adaptada no tiene ni
  necesita (las kcal NO se recalculan: son contexto de IA, no entran en ningún
  cálculo).

  Nada se guarda sin verlo: la IA rellena el textarea y Alex edita antes de dar
  a guardar. Guardar con el texto vacío QUITA la adaptada — sin esa salida, un
  guardado por error sería irreversible en cuanto el toast de deshacer se fuera.
*/
export function AdaptedSessionSheet({
  open,
  onOpenChange,
  date,
  /** Motivo sugerido (capacidad/zona de la lesión vigente); editable siempre. */
  suggestedReason,
  /** Adaptada ya guardada, si la hay: entonces esto es una edición. */
  current,
  /** Texto de partida, si quien abre ya tiene uno. Normalmente vacío: la sesión
   *  la produce el ✨, no se pega desde fuera (DECISIONS #101). */
  initialContent,
  /**
   * ¿Hay sesión del plan de la que partir? Solo se pasa `false` donde se SABE que
   * no la hay. Por defecto true: si resulta que no la hay, el endpoint responde
   * con el motivo real y el error se ve (nunca se adivina un «no se puede»).
   */
  canGenerate = true,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  suggestedReason?: string | null;
  current?: { session: string; reason: string | null } | null;
  initialContent?: string | null;
  canGenerate?: boolean;
  onSaved: () => void | Promise<void>;
}) {
  const [motivo, setMotivo] = useState(
    current?.reason ?? suggestedReason ?? "",
  );
  const [contenido, setContenido] = useState(
    initialContent ?? current?.session ?? "",
  );
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);

  const generate = async () => {
    const reason = motivo.trim();
    if (!reason) {
      toast.error("Escribe el motivo (una lesión, una sobrecarga, el tiempo…).");
      return;
    }
    setGenerating(true);
    try {
      const { contenido: raw } = await api.adaptSession({ date, motivo: reason });
      // Mismo trato que el WOD pegado (F25): el formateo viaja dentro y nunca
      // tumba la generación — si falla, se queda el texto tal cual.
      const formatted = await formatOrKeep(raw);
      setContenido(formatted.contenido);
      if (formatted.reason) toast.warning(formatted.reason);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo adaptar la sesión.",
      );
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const result = await api.saveAdaptedSession({
        date,
        session: contenido,
        reason: motivo,
      });
      await onSaved();
      onOpenChange(false);
      toast.success(
        result.kind === "cleared"
          ? "Sesión adaptada quitada"
          : current
            ? "Sesión adaptada actualizada"
            : "Sesión adaptada guardada",
        {
          action: {
            label: "Deshacer",
            onClick: () => {
              void api
                .undoAdaptedSession(result.undo)
                .then(async () => {
                  await onSaved();
                  toast.success("Restaurada la anterior.");
                })
                .catch((error) =>
                  toast.error(
                    error instanceof Error ? error.message : "No se pudo deshacer.",
                  ),
                );
            },
          },
        },
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      setSaving(false);
    }
  };

  const empty = contenido.trim() === "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[92dvh] gap-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {current ? "Editar sesión adaptada" : "Adaptar sesión"}
          </SheetTitle>
          <SheetDescription>
            {labelForKey(date)} · la del plan no se toca
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          <label className="block">
            <span className="ui-label mb-1.5 block">Motivo</span>
            <input
              value={motivo}
              onChange={(event) => setMotivo(event.target.value)}
              placeholder="hombro derecho, sobrecarga, solo 40 min…"
              className="h-11 w-full rounded-xl border border-input bg-surface px-3 text-base outline-none focus-visible:border-ring"
            />
          </label>

          <button
            type="button"
            onClick={generate}
            disabled={generating || !canGenerate}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {generating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-4" aria-hidden />
            )}
            {generating
              ? "Adaptando…"
              : contenido
                ? "Volver a generar"
                : "Generar con IA"}
          </button>
          {canGenerate ? null : (
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Este día no tiene sesión del plan de la que partir. Puedes escribir
              la adaptada a mano.
            </p>
          )}

          <label className="block">
            <span className="ui-label mb-1.5 block">Sesión adaptada</span>
            <textarea
              value={contenido}
              onChange={(event) => setContenido(event.target.value)}
              rows={12}
              placeholder="Revisa y edita antes de guardar…"
              className="w-full rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring"
            />
          </label>

          <button
            type="button"
            onClick={save}
            disabled={saving || (empty && !current)}
            className="min-h-12 w-full rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60"
          >
            {saving
              ? "Guardando…"
              : empty && current
                ? "Quitar la adaptada"
                : "Guardar sesión adaptada"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
