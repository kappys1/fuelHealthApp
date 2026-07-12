"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { flushQueue, isOffline, queueSize } from "@/lib/offline-queue";

/*
  Sincroniza la cola offline al reconectar (o al montar si ya hay red y hay cosas
  pendientes de una sesión anterior). Reproduce las entradas/campos de día
  encolados y refresca los datos. Montado en el layout de (app).
*/
export function OfflineSync() {
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      if (isOffline()) return;
      if ((await queueSize()) === 0) return;
      const done = await flushQueue();
      if (!cancelled && done > 0) {
        toast.success(
          done === 1
            ? "Sincronizado 1 registro pendiente"
            : `Sincronizados ${done} registros pendientes`,
        );
        qc.invalidateQueries({ queryKey: ["today"] });
      }
    };
    void sync();
    window.addEventListener("online", sync);
    return () => {
      cancelled = true;
      window.removeEventListener("online", sync);
    };
  }, [qc]);

  return null;
}
