"use client";

import { Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, type HealthImportResult } from "@/lib/client-api";

/*
  Import CSV de Health Auto Export con VISTA PREVIA antes de aplicar (07 §4 / F4.2).
  El usuario elige el CSV → se muestra el resumen (filas, métricas, kJ→kcal, cuántos
  días machacan valores manuales) → confirmar aplica el upsert.
*/
export function HealthImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [preview, setPreview] = useState<HealthImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setCsv(null);
    setFileName("");
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const onFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      setCsv(text);
      setFileName(file.name);
      const p = await api.importHealthCsv(text, false);
      setPreview(p);
      if (p.rows === 0) toast.error("No se detectaron filas con fecha en el CSV.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo leer el CSV.");
      reset();
    } finally {
      setBusy(false);
    }
  };

  const apply = async () => {
    if (!csv) return;
    setBusy(true);
    try {
      const r = await api.importHealthCsv(csv, true);
      toast.success(
        `${r.imported} días importados${r.hadKj ? " · kJ→kcal" : ""}${
          r.hadMl ? " · mL→L" : ""
        }`,
      );
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo importar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
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
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface-2 px-4 text-sm text-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Upload className="size-4 text-primary" aria-hidden />
          )}
          Elegir CSV de Health Auto Export
        </button>
      ) : (
        <div className="rounded-lg border border-line bg-surface-2 p-3 text-[13px]">
          <p className="font-medium text-foreground">{fileName}</p>
          <ul className="num mt-2 space-y-0.5 text-muted-foreground">
            <li>{preview.rows} filas con fecha · {preview.days} días</li>
            <li>{preview.metrics} métricas detectadas</li>
            {preview.hadKj ? <li>kJ convertidos a kcal (÷4,184)</li> : null}
            {preview.hadMl ? <li>mL convertidos a L</li> : null}
            {preview.overwriteManual > 0 ? (
              <li className="text-destructive">
                {preview.overwriteManual} días machacan valores manuales
              </li>
            ) : null}
          </ul>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={apply}
              disabled={busy || preview.rows === 0}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Aplicar import
            </button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="rounded-lg px-3 py-2 text-sm text-muted-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
