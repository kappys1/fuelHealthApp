"use client";

import {
  AlertCircle,
  ArrowRight,
  Clock3,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import type { CoachReadingView } from "@/server/ai/coach-reading";

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      hour: "2-digit",
      hour12: false,
    }).format(new Date()),
  );
  if (hour < 13) return "Buenos días, Alex";
  if (hour < 20) return "Buenas tardes, Alex";
  return "Buenas noches, Alex";
}

function savedAt(value: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function CoachGreetingCard({
  reading,
  onOpen,
  onRefresh,
}: {
  reading: CoachReadingView | null;
  onOpen: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await onRefresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo actualizar la lectura.",
      );
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <article className="wellness-card relative overflow-hidden p-[18px]">
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 z-0 rounded-[22px] focus-visible:ring-3 focus-visible:ring-ring/35 focus-visible:outline-none"
        aria-label="Ver lectura del Coach"
      />
      <div className="pointer-events-none relative z-[1] flex items-start gap-3 pr-11">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Sparkles className="size-[18px]" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="ui-label">Coach · {reading ? "lectura guardada" : "bajo demanda"}</p>
          <h2 className="mt-1 font-display text-[17px] leading-tight font-semibold text-foreground">
            {greeting()}
          </h2>
          <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">
            {reading?.text ??
              "Actualiza cuando quieras una lectura basada en tus datos del día. Entrar en Hoy no consume IA."}
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            {reading ? (
              <>
                <Clock3 className="size-3.5" aria-hidden />
                {reading.stale
                  ? "Hay datos nuevos · lectura pendiente de actualizar"
                  : `Guardada a las ${savedAt(reading.generatedAt)}`}
              </>
            ) : (
              <>
                Ver opciones <ArrowRight className="size-3.5" aria-hidden />
              </>
            )}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void refresh()}
        disabled={refreshing}
        className="app-icon-button absolute top-4 right-4 z-10 text-primary disabled:opacity-50"
        aria-label="Actualizar lectura del Coach"
        title="Actualizar lectura del Coach"
      >
        <RefreshCw className={`size-[18px] ${refreshing ? "animate-spin" : ""}`} aria-hidden />
      </button>

      {error ? (
        <div
          role="alert"
          className="relative z-10 mt-3 flex items-start gap-2 rounded-xl border border-destructive/35 bg-destructive/8 px-3 py-2.5 text-[12px] text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </div>
      ) : null}
    </article>
  );
}
