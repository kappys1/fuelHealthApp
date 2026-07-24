"use client";

import { Download, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { api, type RestoreResult } from "@/lib/client-api";

/*
  Export JSON completo (1 clic) + import/restore con vista previa (F4.5 / 07 §4).
  El restore REEMPLAZA todos los datos → vista previa con conteos y CONFIRMACIÓN
  explícita (excepción del principio de «undo, no confirmaciones» — 07 §2).
*/

const TABLE_LABELS: Record<string, string> = {
  dietVersions: "versiones de dieta",
  planOptions: "opciones de plan",
  days: "días",
  mealEntries: "entradas",
  healthMetrics: "métricas de salud",
  workouts: "entrenamientos",
  medMeasurements: "MED",
  favorites: "favoritos",
  products: "productos",
  dayTemplates: "plantillas",
  settings: "ajustes",
  chatThreads: "hilos de chat",
  chatMessages: "mensajes de chat",
};

export function DataBackup() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  // `raw` solo se lee dentro de handlers (apply), nunca en el render → useRef
  // para no repintar al cargar el archivo (react-doctor/rerender-state-only-in-handlers).
  const rawRef = useRef<unknown>(null);
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState<RestoreResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const reset = () => {
    rawRef.current = null;
    setFileName("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      rawRef.current = parsed;
      setFileName(file.name);
      const p = await api.restore(parsed, false);
      setPreview(p);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Archivo inválido.");
      reset();
    } finally {
      setBusy(false);
    }
  };

  /**
   * Descarga un export del estado ACTUAL antes de restaurar. Un restore a medias
   * nunca puede perder datos: si esto falla, se aborta antes de tocar la BD.
   */
  const downloadPreRestoreBackup = async () => {
    const res = await fetch("/api/export");
    if (!res.ok) throw new Error(`No se pudo crear el backup previo (${res.status}).`);
    const blob = await res.blob();
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const name = match?.[1]?.replace("export", "pre-restore") ?? "fuelboard-pre-restore.json";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const apply = async () => {
    if (rawRef.current == null) return;
    setBusy(true);
    try {
      // Backup automático pre-restore (principio 7: 0 pérdidas). Si falla, aborta.
      try {
        await downloadPreRestoreBackup();
      } catch (err) {
        toast.error(
          err instanceof Error
            ? `${err.message} Restore cancelado.`
            : "No se pudo crear el backup previo. Restore cancelado.",
        );
        setBusy(false);
        return;
      }
      const r = await api.restore(rawRef.current, true);
      const total = Object.values(r.restored ?? {}).reduce((a, b) => a + b, 0);
      toast.success(`Restaurado: ${total} registros`);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo restaurar.");
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  const rows = (counts: Record<string, number> | undefined) =>
    Object.entries(counts ?? {})
      .filter(([, v]) => v > 0)
      .map(([k, v]) => `${v} ${TABLE_LABELS[k] ?? k}`)
      .join(" · ");

  return (
    <>
      <div className="flex flex-wrap gap-2">
      <a
        href="/api/export"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-[13px] font-medium text-foreground"
      >
        <Download className="size-4 text-primary" aria-hidden />
        Exportar copia (JSON)
      </a>

        <div>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        {!preview ? (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface-2 px-4 text-[13px] font-medium text-foreground disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <Upload className="size-4 text-primary" aria-hidden />
            )}
            Restaurar desde copia…
          </button>
        ) : (
          <div className="mt-3 rounded-2xl bg-surface-2 p-4 text-[13px] ring-1 ring-line">
            <p className="font-medium text-foreground">{fileName}</p>
            <p className="mt-2 text-muted-foreground">
              Se restaurará: <span className="text-foreground">{rows(preview.incoming) || "nada"}</span>.
            </p>
            <p className="mt-1 text-destructive">
              Reemplaza lo actual ({rows(preview.current) || "vacío"}).
            </p>
            <p className="mt-1 text-muted-foreground">
              Antes se descargará un backup automático del estado actual.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                disabled={busy}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              >
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Restaurar (reemplaza todo)
              </button>
              <button
                type="button"
                onClick={reset}
                disabled={busy}
                className="min-h-11 rounded-xl px-3 text-sm font-medium text-muted-foreground"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => !busy && setConfirmOpen(open)}
        title="Restaurar copia de seguridad"
        description="Se reemplazarán todos los datos actuales. Antes se descargará automáticamente una copia del estado actual."
        confirmLabel="Restaurar y reemplazar"
        busy={busy}
        onConfirm={apply}
      />
    </>
  );
}
