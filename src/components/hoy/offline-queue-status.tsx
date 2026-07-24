"use client";

import { AlertCircle, CloudOff, CloudUpload } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { discardFailedOperation, flushQueue } from "@/lib/offline-queue";
import { useOfflineQueue } from "@/lib/use-offline-queue";

export function OfflineQueueStatus() {
  const qc = useQueryClient();
  const queue = useOfflineQueue();
  const [retrying, setRetrying] = useState(false);
  if (queue.pending === 0 && queue.online && queue.phase === "idle") return null;

  const failed = queue.phase === "failed";
  const syncing = queue.phase === "syncing";
  const Icon = failed ? AlertCircle : queue.online ? CloudUpload : CloudOff;
  const title = failed
    ? "Sincronización pendiente"
    : syncing
      ? "Sincronizando cambios"
      : `${queue.pending} ${queue.pending === 1 ? "registro pendiente" : "registros pendientes"}`;
  const detail = failed
    ? queue.online
      ? queue.failure?.message ?? "No se borró nada de la cola. Puedes reintentar ahora."
      : "No se borró nada de la cola; se reintentará al recuperar la conexión."
    : syncing
      ? "Enviando la cola local de forma segura."
      : queue.online
        ? "Con conexión · se enviarán en el siguiente intento de sincronización."
        : "Sin conexión · se enviarán automáticamente al volver.";

  return (
    <section
      role="status"
      aria-live="polite"
      className={`flex items-center gap-3 rounded-2xl border px-3.5 py-3 ${
        failed
          ? "border-destructive/35 bg-destructive/8"
          : "border-primary/25 bg-primary-soft"
      }`}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-surface text-primary shadow-sm">
        <Icon className={`size-4 ${syncing ? "animate-pulse" : ""}`} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <strong className="block text-[12px] font-semibold text-foreground">{title}</strong>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">
          {detail}
        </span>
      </span>
      {failed && queue.online ? (
        <button
          type="button"
          disabled={retrying}
          onClick={() => {
            setRetrying(true);
            const action = queue.failure?.retriable
              ? flushQueue()
              : discardFailedOperation().then(() => flushQueue());
            void action
              .then((done) => {
                if (done > 0) qc.invalidateQueries({ queryKey: ["today"] });
              })
              .finally(() => setRetrying(false));
          }}
          className="min-h-11 shrink-0 rounded-xl px-3 text-[12px] font-semibold text-primary disabled:opacity-50"
        >
          {retrying
            ? "Procesando…"
            : queue.failure?.retriable
              ? "Reintentar"
              : "Descartar cambio"}
        </button>
      ) : queue.pending > 0 ? (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-surface font-display text-[12px] font-semibold tabular-nums text-primary">
          {queue.pending}
        </span>
      ) : null}
    </section>
  );
}
