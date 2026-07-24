"use client";

import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Loader2,
  Sparkles,
  WifiOff,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useReducer } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { api } from "@/lib/client-api";
import { useOnline } from "@/lib/use-online";
import type {
  CoachMode,
  CoachReading,
  CoachReadingView,
} from "@/server/ai/coach-reading";

interface CoachSheetState {
  mode: CoachMode | null;
  loading: boolean;
  text: string | null;
  contextHash: string | null;
  generatedAt: string | null;
  error: string | null;
  copied: boolean;
  bridging: boolean;
  cachedVisible: boolean;
}

type CoachSheetAction =
  | { type: "reset"; showCache: boolean }
  | { type: "show"; reading: CoachReadingView }
  | { type: "start"; mode: CoachMode }
  | { type: "success"; reading: CoachReading }
  | { type: "error"; message: string }
  | { type: "copied"; value: boolean }
  | { type: "bridging"; value: boolean };

const INITIAL_STATE: CoachSheetState = {
  mode: null,
  loading: false,
  text: null,
  contextHash: null,
  generatedAt: null,
  error: null,
  copied: false,
  bridging: false,
  cachedVisible: true,
};

function coachSheetReducer(
  state: CoachSheetState,
  action: CoachSheetAction,
): CoachSheetState {
  switch (action.type) {
    case "reset":
      return { ...INITIAL_STATE, cachedVisible: action.showCache };
    case "start":
      return {
        ...state,
        mode: action.mode,
        loading: true,
        text: null,
        contextHash: null,
        generatedAt: null,
        error: null,
        cachedVisible: false,
      };
    case "show":
      return {
        ...INITIAL_STATE,
        mode: action.reading.mode,
        text: action.reading.text,
        contextHash: action.reading.contextHash,
        generatedAt: action.reading.generatedAt,
        cachedVisible: true,
      };
    case "success":
      return {
        ...state,
        loading: false,
        mode: action.reading.mode,
        text: action.reading.text,
        contextHash: action.reading.contextHash,
        generatedAt: action.reading.generatedAt,
      };
    case "error":
      return { ...state, loading: false, error: action.message };
    case "copied":
      return { ...state, copied: action.value };
    case "bridging":
      return { ...state, bridging: action.value };
  }
}

export function CoachSheet({
  open,
  onOpenChange,
  date,
  initialReadings,
  onReading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: string;
  initialReadings: Record<CoachMode, CoachReadingView | null>;
  onReading: (reading: CoachReading) => void;
}) {
  const online = useOnline();
  const router = useRouter();
  const [state, dispatch] = useReducer(coachSheetReducer, INITIAL_STATE);

  const defaultReading = initialReadings.hoy;
  const shownText = state.text ??
    (state.cachedVisible ? defaultReading?.text ?? null : null);
  const shownMode: CoachMode | null = state.mode ??
    (state.cachedVisible ? defaultReading?.mode ?? null : null);
  const cachedReading = shownMode ? initialReadings[shownMode] : null;
  const shownContextHash = state.contextHash ??
    (state.cachedVisible ? defaultReading?.contextHash ?? null : null);
  const shownGeneratedAt = state.generatedAt ??
    (state.cachedVisible ? defaultReading?.generatedAt ?? null : null);

  const reset = (showCache = true) => {
    dispatch({ type: "reset", showCache });
  };

  const run = async (nextMode: CoachMode) => {
    dispatch({ type: "start", mode: nextMode });
    try {
      const reading = await api.coach(date, nextMode);
      dispatch({ type: "success", reading });
      onReading(reading);
    } catch (caught) {
      dispatch({
        type: "error",
        message:
          caught instanceof Error ? caught.message : "No se pudo analizar el día.",
      });
    }
  };

  const copy = async () => {
    if (!shownText) return;
    try {
      await navigator.clipboard.writeText(shownText);
      dispatch({ type: "copied", value: true });
      setTimeout(() => dispatch({ type: "copied", value: false }), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  const continueInChat = async () => {
    if (
      !shownText ||
      !shownMode ||
      !shownContextHash ||
      !shownGeneratedAt ||
      state.bridging
    ) return;
    dispatch({ type: "bridging", value: true });
    try {
      const userMessage = shownMode === "hoy" ? "¿Cómo voy hoy?" : "Analizar ayer";
      const handoffId = `coach:${shownMode}:${shownContextHash}:${shownGeneratedAt}`;
      const { threadId } = await api.seedChatThread(
        userMessage,
        shownText,
        handoffId,
      );
      onOpenChange(false);
      reset();
      router.push(`/chat?thread=${threadId}`);
    } catch (caught) {
      dispatch({ type: "bridging", value: false });
      toast.error(
        caught instanceof Error ? caught.message : "No se pudo abrir el chat.",
      );
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) reset();
      }}
    >
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" aria-hidden /> Coach
          </SheetTitle>
          <SheetDescription>Lecturas guardadas y análisis bajo demanda.</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6">
          {state.loading ? (
            <div className="flex items-center gap-2 py-8 text-[14px] text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Analizando tu día…
            </div>
          ) : state.error ? (
            <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/8 p-3 text-[13px] text-destructive">
              {state.error}
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => reset(true)} className="min-h-11 rounded-xl px-3 text-[12px] font-medium text-foreground">
                  Volver a la guardada
                </button>
                <button type="button" onClick={() => void run(state.mode ?? "hoy")} className="min-h-11 rounded-xl px-3 text-[12px] font-semibold text-destructive">
                  Reintentar
                </button>
              </div>
            </div>
          ) : shownText ? (
            <>
              <button
                type="button"
                onClick={() => reset(false)}
                className="mb-3 inline-flex min-h-11 items-center gap-1.5 text-[12px] font-medium text-muted-foreground"
              >
                <ArrowLeft className="size-4" aria-hidden /> Otras lecturas
              </button>
              {state.cachedVisible && cachedReading ? (
                <p className="mb-3 rounded-xl bg-surface-2 px-3 py-2 text-[11px] text-muted-foreground">
                  {cachedReading.stale
                    ? "Hay datos nuevos. Esta es la última lectura guardada."
                    : "Lectura guardada · abrirla no consume IA."}
                </p>
              ) : null}
              <p className="mb-2 text-[11px] font-semibold text-primary">
                {shownMode === "ayer" ? "Lectura de ayer" : "Lectura de hoy"}
              </p>
              <Markdown text={shownText} className="space-y-2 text-[14px] leading-relaxed text-foreground" />
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface text-[12px] font-medium text-foreground">
                  {state.copied ? <Check className="size-4 text-protein" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                  {state.copied ? "Copiado" : "Copiar"}
                </button>
                <button type="button" onClick={() => void continueInChat()} disabled={state.bridging} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary text-[12px] font-semibold text-primary-foreground disabled:opacity-50">
                  {state.bridging ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ArrowRight className="size-4" aria-hidden />}
                  Seguir en Chat
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="grid gap-2">
                <ModeButton
                  label="¿Cómo voy hoy?"
                  hint={initialReadings.hoy ? "Abrir lectura guardada" : "Lectura del día en curso"}
                  disabled={!online && !initialReadings.hoy}
                  onClick={() => initialReadings.hoy
                    ? dispatch({ type: "show", reading: initialReadings.hoy })
                    : void run("hoy")}
                />
                <ModeButton
                  label="Analizar ayer"
                  hint={initialReadings.ayer ? "Abrir lectura guardada" : "Revisión del último día cerrado"}
                  disabled={!online && !initialReadings.ayer}
                  onClick={() => initialReadings.ayer
                    ? dispatch({ type: "show", reading: initialReadings.ayer })
                    : void run("ayer")}
                />
              </div>
              {!online ? (
                <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-muted-foreground">
                  <WifiOff className="size-3.5" aria-hidden /> El Coach necesita conexión.
                </p>
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
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-[70px] items-center justify-between rounded-2xl border border-line bg-surface px-4 text-left shadow-card disabled:opacity-50"
    >
      <span>
        <strong className="block text-[14px] font-semibold text-foreground">{label}</strong>
        <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>
      </span>
      <ArrowRight className="size-4 text-primary" aria-hidden />
    </button>
  );
}
