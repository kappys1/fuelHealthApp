"use client";

import { Pencil } from "lucide-react";
import { TrainingContentBlocks } from "@/components/training/training-session-detail";
import { dayKey, labelForKey } from "@/lib/dates";
import { cn } from "@/lib/utils";

/*
  F26 Fase 2 · la sesión adaptada del día, junto a la del plan (AC8). Se lee con
  los MISMOS bloques y grupos que la planificada (`TrainingContentBlocks`): lo
  que cambia es el marco, no el idioma. Sin kcal: no se recalculan a propósito
  (son contexto de IA con ±25 %, no entran en ningún cálculo — teatro de
  precisión, principio 2).
*/
export function AdaptedSessionCard({
  contenido,
  motivo,
  adaptedAt,
  onEdit,
  className,
}: {
  contenido: string;
  motivo: string | null;
  /** ISO de cuándo se guardó; solo se muestra el día. */
  adaptedAt: string | null;
  onEdit: () => void;
  className?: string;
}) {
  return (
    <article
      className={cn(
        "wellness-card overflow-hidden p-5 ring-1 ring-primary/30",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="inline-flex rounded-full bg-primary/12 px-2.5 py-1 text-[10px] font-bold tracking-wide text-primary">
          ADAPTADA
        </p>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-2 text-[13px] font-semibold text-primary"
        >
          <Pencil className="size-3.5" aria-hidden />
          Editar
        </button>
      </div>

      {/*
        El motivo puede venir del Chat y ser un párrafo entero (es el mensaje de
        Alex, y así se le da entero al generador). En el título se acota a dos
        líneas: completo ocupaba media pantalla antes de llegar a la sesión.
      */}
      <h2
        title={motivo?.trim() || undefined}
        className="mt-2 line-clamp-2 font-display text-[22px] font-semibold leading-tight text-foreground"
      >
        {motivo?.trim() ? `Adaptada · ${motivo.trim()}` : "Sesión adaptada"}
      </h2>

      <p className="num mt-1.5 text-[12px] leading-relaxed text-muted-foreground">
        {/* El ISO viene en UTC: la clave de día se saca en Europe/Madrid, nunca
            cortando la cadena (eso desplazaría el día por la noche). */}
        {adaptedAt
          ? `Guardada el ${labelForKey(dayKey(new Date(adaptedAt)))}`
          : "Guardada"}
        {" · es la sesión de hoy"}
      </p>

      <TrainingContentBlocks contenido={contenido} />
    </article>
  );
}
