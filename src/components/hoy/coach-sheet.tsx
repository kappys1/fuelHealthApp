"use client";

import { ArrowLeft, Check, Copy, Loader2, Sparkles, WifiOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { useOnline } from "@/lib/use-online";

/*
  Coach diario (F-IA-6) tras el ✨ del FuelGauge, en sheet. Dos modos: «¿Cómo voy
  hoy?» (día en curso) y «Analizar ayer» (día terminado). Respuesta en texto plano
  (white-space: pre-wrap). Deshabilitado sin conexión con motivo visible (07 §4).
*/
type Mode = "hoy" | "ayer";

export function CoachSheet({
  open,
  onOpenChange,
  date,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: string;
}) {
  const online = useOnline();
  const [mode, setMode] = useState<Mode | null>(null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setMode(null);
    setText(null);
    setError(null);
    setCopied(false);
  };

  const run = async (m: Mode) => {
    setMode(m);
    setLoading(true);
    setText(null);
    setError(null);
    try {
      const r = await api.coach(date, m);
      setText(r.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo analizar el día.");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[88dvh] gap-0 overflow-y-auto">
        <SheetHeader className="pb-2">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden /> Coach
          </SheetTitle>
        </SheetHeader>

        <div className="px-4 pb-6">
          {mode == null ? (
            <>
              <p className="text-[13px] text-muted-foreground">
                Un vistazo rápido a tu día con el contexto completo (comidas, peso,
                sesión, notas). Observa y sugiere; no prescribe dieta.
              </p>
              <div className="mt-4 grid gap-2">
                <ModeButton
                  label="¿Cómo voy hoy?"
                  hint="Qué te falta para cuadrar el día"
                  disabled={!online}
                  onClick={() => run("hoy")}
                />
                <ModeButton
                  label="Analizar ayer"
                  hint="Qué hiciste bien y acciones para hoy"
                  disabled={!online}
                  onClick={() => run("ayer")}
                />
              </div>
              {!online ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                  <WifiOff className="size-3.5" aria-hidden /> Sin conexión: el coach
                  necesita red.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={reset}
                className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden />
                {mode === "hoy" ? "¿Cómo voy hoy?" : "Analizar ayer"}
              </button>

              {loading ? (
                <div className="flex items-center gap-2 py-8 text-[14px] text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando tu
                  día…
                </div>
              ) : error ? (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-[13px] text-destructive">
                  {error}
                  <button
                    type="button"
                    onClick={() => run(mode)}
                    className="mt-2 block text-[12px] font-medium underline"
                  >
                    Reintentar
                  </button>
                </div>
              ) : text ? (
                <>
                  <Markdown
                    text={text}
                    className="space-y-2 text-[14px] leading-relaxed text-foreground"
                  />
                  <button
                    type="button"
                    onClick={copy}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[13px] text-foreground"
                  >
                    {copied ? (
                      <Check className="size-4 text-protein" aria-hidden />
                    ) : (
                      <Copy className="size-4" aria-hidden />
                    )}
                    {copied ? "Copiado" : "Copiar"}
                  </button>
                </>
              ) : null}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ModeButton({
  label,
  hint,
  disabled,
  onClick,
}: {
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex flex-col items-start rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:opacity-50"
    >
      <span className="text-[15px] font-semibold text-foreground">{label}</span>
      <span className="text-[12px] text-muted-foreground">{hint}</span>
    </button>
  );
}
