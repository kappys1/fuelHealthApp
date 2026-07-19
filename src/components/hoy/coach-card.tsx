"use client";

import { ChevronRight, Sparkles } from "lucide-react";

/*
  Tarjeta Coach on-demand (Restyle v2 · F1, DECISIONS #71). NO llama a la IA al abrir
  Hoy: muestra el último análisis cacheado (texto + «hace X» del servidor) y abre el
  CoachSheet para ver el completo / re-analizar / seguir en el chat. Sin caché ese día,
  CTA «Analizar mi día». Toda la lógica de IA vive en el sheet; esto es solo la entrada.
*/
export function CoachCard({
  coach,
  onOpen,
}: {
  coach: { text: string; ts: number; ago: string } | null;
  onOpen: () => void;
}) {
  // Vista previa: primera línea no vacía del markdown, sin marcas de encabezado.
  const preview = coach
    ? (coach.text
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .find((l) => l.length > 0) ?? "")
    : "";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={coach ? "Ver o actualizar el análisis del coach" : "Analizar mi día con el coach"}
      className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-surface p-3.5 text-left shadow-[var(--card-shadow)] transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
        <Sparkles className="size-[18px]" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="text-[14px] font-semibold text-foreground">Coach</span>
          {coach ? (
            <span className="text-[12px] text-muted-foreground">· {coach.ago}</span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] text-muted-foreground">
          {coach ? preview : "Analizar mi día con el contexto completo"}
        </span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-medium text-primary">
        {coach ? "Ver" : "Analizar"}
        <ChevronRight className="size-4" aria-hidden />
      </span>
    </button>
  );
}
