"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import {
  flushQueue,
  isOffline,
  markOffline,
  OFFLINE_QUEUE_ENQUEUED_EVENT,
  queueSize,
  refreshOfflineQueueStatus,
} from "@/lib/offline-queue";

/*
  Sincroniza la cola offline al reconectar (o al montar si ya hay red y hay cosas
  pendientes de una sesión anterior). Reproduce las entradas/campos de día
  encolados y refresca los datos. Montado en el layout de (app).
*/
export function OfflineSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let syncRequested = false;
    const sync = async () => {
      if (syncing) {
        syncRequested = true;
        return;
      }
      syncing = true;
      try {
        do {
          syncRequested = false;
          if (isOffline()) {
            await markOffline();
            return;
          }
          await refreshOfflineQueueStatus();
          const before = await queueSize();
          if (before === 0) return;
          const done = await flushQueue();
          if (!cancelled && done > 0) {
            toast.success(
              done === 1
                ? "Sincronizado 1 registro pendiente"
                : `Sincronizados ${done} registros pendientes`,
            );
            qc.invalidateQueries({ queryKey: ["today"] });
          }
          const after = await queueSize();
          // Sigue drenando si llegaron operaciones después del snapshot inicial.
          // Sin progreso, conserva la cola en estado failed y espera otro evento.
          if (after >= before && done === 0) return;
        } while (syncRequested || (await queueSize()) > 0);
      } finally {
        syncing = false;
        if (syncRequested && !cancelled) void sync();
      }
    };
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener(OFFLINE_QUEUE_ENQUEUED_EVENT, sync);
    const offline = () => void markOffline();
    window.addEventListener("offline", offline);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
      window.removeEventListener(OFFLINE_QUEUE_ENQUEUED_EVENT, sync);
      window.removeEventListener("offline", offline);
    };
  }, [qc]);

  return null;
}
