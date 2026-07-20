"use client";

import { RefreshCw, Sparkles } from "lucide-react";

/*
  coach-welcome (Restyle v2 · estructura real del mockup): banner superior de Hoy que
  combina saludo + última lectura del Coach cacheada + estado de caché + refrescar.
  NO llama a la IA al abrir Hoy (#71): muestra el análisis guardado; el botón abre el
  CoachSheet para ver/re-analizar. Sin caché ese día → CTA para analizar.
*/
function greeting(hour: number): string {
  if (hour < 12) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}

function madridHour(): number {
  return Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
}

export function CoachWelcome({
  coach,
  onOpen,
}: {
  coach: { text: string; ts: number; ago: string } | null;
  onOpen: () => void;
}) {
  const analysis = coach
    ? (coach.text
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .find((l) => l.length > 0) ?? "")
    : "Analiza tu día para ver la lectura del coach.";

  return (
    <article className="flex items-start gap-3 rounded-[18px] border border-line bg-surface p-3.5 shadow-[var(--card-shadow)]">
      <button
        type="button"
        onClick={onOpen}
        aria-label={coach ? "Ver la lectura del coach" : "Analizar mi día con el coach"}
        className="flex min-w-0 flex-1 items-start gap-3 text-left"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary-soft text-primary">
          <Sparkles className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-[10px] font-bold tracking-[0.1em] text-muted-foreground uppercase">
            {coach ? "Coach · lectura guardada" : "Coach · sin análisis hoy"}
          </span>
          <strong className="mt-0.5 block text-[15px] font-bold text-foreground">
            {greeting(madridHour())}
          </strong>
          <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
            {analysis}
          </span>
          {coach ? (
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Guardada {coach.ago} · sin consumo al abrir
            </span>
          ) : null}
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        aria-label="Actualizar análisis del coach"
        className="inline-flex size-8 shrink-0 items-center justify-center rounded-[10px] border border-line bg-surface-2 text-primary transition-colors hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <RefreshCw className="size-4" aria-hidden />
      </button>
    </article>
  );
}
