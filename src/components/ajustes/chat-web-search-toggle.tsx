"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/client-api";

/**
 * Interruptor global de búsqueda web del chat (F05 Fase 1, default ON). Freno de
 * COSTE: mientras está ON el chat puede buscar en internet (disparo automático)
 * para comer fuera / productos de marca; OFF vuelve al comportamiento de la Fase
 * 0 (sin web). Optimista con reversión si el guardado falla. No es un toggle por
 * mensaje (P3: la fricción mata el sistema).
 */
export function ChatWebSearchToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [saving, setSaving] = useState(false);

  const onChange = async (next: boolean) => {
    setEnabled(next); // optimista
    setSaving(true);
    try {
      const res = await api.saveChatWebSearch(next);
      setEnabled(res.enabled);
      toast.success(
        res.enabled
          ? "Búsqueda web del chat activada."
          : "Búsqueda web del chat desactivada.",
      );
    } catch (err) {
      setEnabled(!next); // revertir
      toast.error(err instanceof Error ? err.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor="chat-web-search" className="text-sm text-foreground">
        El chat puede buscar en internet cartas de restaurante y productos de
        marca (para comer fuera). Cita la fuente en su respuesta.
      </label>
      <Switch
        id="chat-web-search"
        checked={enabled}
        onCheckedChange={onChange}
        disabled={saving}
        aria-label="Búsqueda web del chat"
      />
    </div>
  );
}
