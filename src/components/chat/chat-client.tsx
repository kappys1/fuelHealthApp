"use client";

import {
  AlertCircle,
  ArrowLeft,
  ChartNoAxesCombined,
  Check,
  ChevronRight,
  Copy,
  Gauge,
  Loader2,
  MessageCircle,
  MessageSquarePlus,
  ScanSearch,
  Send,
  Sparkles,
  Trash2,
  Waves,
  WifiOff,
} from "lucide-react";
import { type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/client-api";
import { CHAT_MAX_CHARS } from "@/lib/schemas";
import { relativeDate } from "@/lib/relative-time";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import type { MessageDTO, ThreadDTO } from "@/server/db/queries/chat";

/*
  Chat sobre tus datos (F-IA-8). Hilos persistentes, streaming, chips de preguntas
  sugeridas al abrir un hilo vacío, copiar por mensaje. Guardarraíles (principio 8)
  viven en el system prompt del servidor: la IA observa y explica, no prescribe.
  Sin conexión: composición deshabilitada con motivo (07 §4).

  ChatClient es el controlador: posee todo el estado y los effects (scroll/teclado
  iOS/panel). Las vistas (lista de hilos, área de mensajes, composer) son
  presentacionales y viven como subcomponentes; los refs que los effects necesitan
  se pasan hacia abajo, así el comportamiento no cambia al trocear el JSX.
*/
const QUICK_PROMPTS = [
  {
    text: "¿Cómo cierro bien el día?",
    Icon: Gauge,
    color: "var(--carb)",
  },
  {
    text: "¿Cómo va mi semana?",
    Icon: ChartNoAxesCombined,
    color: "var(--cobalt)",
  },
  {
    text: "Compara mis dos cargas",
    Icon: Waves,
    color: "var(--special)",
  },
  {
    text: "¿Qué coincide con mi hinchazón?",
    Icon: ScanSearch,
    color: "var(--protein)",
  },
] as const;

interface UIMessage extends Omit<MessageDTO, "id" | "createdAt"> {
  id: string;
}

interface SendErrorState {
  message: string;
  retryText: string;
  turnId: string;
}

let tmp = 0;
const tmpId = () => `t${tmp++}`;

export function ChatClient({
  initialThreads,
  initialThreadId = null,
  nowIso,
}: {
  initialThreads: ThreadDTO[];
  initialThreadId?: number | null;
  nowIso: string;
}) {
  const online = useOnline();
  const kbOpen = useKeyboardOpen();
  const [threads, setThreads] = useState<ThreadDTO[]>(initialThreads);
  const [activeId, setActiveId] = useState<number | null>(initialThreadId);
  const [view, setView] = useState<"list" | "thread">(
    initialThreadId != null ? "thread" : "list",
  );
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadLoadError, setThreadLoadError] = useState<string | null>(null);
  const [activeTitle, setActiveTitle] = useState<string | null>(
    () =>
      initialThreads.find((thread) => thread.id === initialThreadId)?.title ?? null,
  );
  const [sendError, setSendError] = useState<SendErrorState | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ThreadDTO | null>(null);
  const [deleting, setDeleting] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  // ¿El usuario está pegado al fondo? Se actualiza al scrollear. Sirve para
  // re-anclar al fondo cuando el viewport cambia (teclado iOS abre/cierra) sin
  // dar tirones si estaba leyendo mensajes de más arriba.
  const atBottomRef = useRef(true);
  const onMessagesScroll = () => {
    const el = scrollRef.current;
    if (el) atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };
  const scrollToBottom = useCallback(() => {
    // Doble rAF: el markdown reajusta su alto tras montar, así que medimos
    // scrollHeight un frame después del layout; si no, al abrir un hilo se
    // quedaba a media altura.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  }, []);
  useEffect(scrollToBottom, [messages, streaming, scrollToBottom]);

  // Teclado iOS (abrir/cerrar) y rotación cambian el ALTO del contenedor durante
  // ~300ms de animación. `focusout`/eventos de teclado llegan antes de que termine,
  // así que adivinar el instante con setTimeout es frágil. ResizeObserver dispara en
  // CADA paso del cambio de alto → re-anclamos y caemos en el tamaño final de forma
  // determinista. Solo si ya estábamos al fondo (no dar tirón a quien lee historial;
  // el resize no genera eventos de scroll, así que `atBottomRef` conserva su valor).
  useEffect(() => {
    const el = scrollRef.current;
    if (view !== "thread" || !el) return;
    const ro = new ResizeObserver(() => {
      if (atBottomRef.current) el.scrollTop = el.scrollHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [view]);

  // El hilo se pinta como panel `fixed` (altura definida → composer anclado +
  // scroll interno). Medimos el borde inferior del header por JS para el `top` del
  // panel: un valor concreto en px es más fiable que una var CSS (que en dev llegó
  // a no resolver y dejaba el panel tapando el header).
  const [panelTop, setPanelTop] = useState(61);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    const measure = () => setPanelTop(header.getBoundingClientRect().bottom);
    // rAF para el inicial: evita setState síncrono en el cuerpo del effect.
    const raf = requestAnimationFrame(measure);
    const ro = new ResizeObserver(measure);
    ro.observe(header);
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  // BUG iOS: al cerrar el teclado, Safari deja la ventana scrolleada y el panel
  // `fixed` pintado con el tamaño de cuando el teclado estaba abierto → queda un
  // hueco abajo hasta que haces scroll (que fuerza el repintado). Al detectar el
  // cierre (kbOpen → false) reseteamos el scroll de ventana y forzamos un
  // reflow/repaint del panel, escalonado para cubrir la animación (~300ms).
  useEffect(() => {
    if (view !== "thread" || kbOpen) return;
    const kick = () => {
      if (window.scrollY !== 0) window.scrollTo(0, 0);
      const p = panelRef.current;
      if (p) {
        p.style.transform = "translateY(0)";
        void p.offsetHeight; // fuerza reflow
        p.style.transform = "";
      }
    };
    const ids = [0, 150, 350, 600].map((d) => window.setTimeout(kick, d));
    return () => ids.forEach(clearTimeout);
  }, [kbOpen, view]);

  const openThread = useCallback(
    async (id: number) => {
      setActiveId(id);
      setActiveTitle(threads.find((thread) => thread.id === id)?.title ?? null);
      setView("thread");
      setMessages([]);
      setStreaming(null);
      setSendError(null);
      setThreadLoadError(null);
      setLoadingThread(true);
      try {
        const thread = await api.getThread(id);
        setActiveTitle(thread.title);
        setMessages(
          thread.messages.map((message) => ({
            id: String(message.id),
            role: message.role,
            content: message.content,
            turnId: message.turnId,
          })),
        );
        scrollToBottom();
      } catch (err) {
        setThreadLoadError(
          err instanceof Error ? err.message : "No se pudo abrir la conversación.",
        );
      } finally {
        setLoadingThread(false);
      }
    },
    [scrollToBottom, threads],
  );

  // Puente Coach → Chat (F01 Fase 2): al entrar con ?thread=<id>, abre ese hilo
  // (sembrado con la pregunta + la respuesta del coach) y enfoca el input.
  const openedRef = useRef(false);
  useEffect(() => {
    if (initialThreadId == null || openedRef.current) return;
    openedRef.current = true;
    openThread(initialThreadId).then(() => inputRef.current?.focus());
  }, [initialThreadId, openThread]);

  const newThread = () => {
    setActiveId(null);
    setView("thread");
    setMessages([]);
    setStreaming(null);
    setInput("");
    setActiveTitle(null);
    setSendError(null);
    setThreadLoadError(null);
  };

  const backToList = () => {
    setView("list");
    setActiveId(null);
    setActiveTitle(null);
    setSendError(null);
    setThreadLoadError(null);
  };

  const removeThread = async (thread: ThreadDTO) => {
    const id = thread.id;
    setDeleting(true);
    const prev = threads;
    setThreads((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteThread(id);
      setPendingDelete(null);
      toast.success("Conversación borrada.");
    } catch (err) {
      setThreads(prev);
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    } finally {
      setDeleting(false);
    }
  };

  const send = async (text: string, retryTurnId?: string) => {
    const message = text.trim();
    if (!message || sending) return;
    if (message.length > CHAT_MAX_CHARS) {
      toast.error(`Mensaje demasiado largo (máx. ${CHAT_MAX_CHARS} caracteres).`);
      return;
    }
    setInput("");
    setSendError(null);
    const turnId = retryTurnId ?? crypto.randomUUID();
    if (!retryTurnId) {
      setMessages((current) => [
        ...current,
        { id: tmpId(), role: "user", content: message, turnId },
      ]);
    }
    setStreaming("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeId, message, turnId }),
      });
      const headerId = res.headers.get("X-Thread-Id");
      const newId = headerId ? Number(headerId) : null;
      if (newId != null && Number.isFinite(newId) && activeId == null) {
        setActiveId(newId);
        setActiveTitle(message.split(/\s+/).slice(0, 6).join(" "));
        api
          .listThreads()
          .then((result) => setThreads(result.threads))
          .catch(() => undefined);
      }
      if (!res.ok || !res.body) {
        let msg = `Error ${res.status}`;
        try {
          const b = await res.json();
          if (b?.error) msg = `${b.error} (${res.status})`;
        } catch {
          /* respuesta no-JSON */
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setStreaming(acc);
      }
      acc += decoder.decode();
      if (!acc.trim()) throw new Error("La IA no devolvió una respuesta. Reinténtalo.");

      setMessages((m) => [
        ...m,
        { id: tmpId(), role: "assistant", content: acc, turnId },
      ]);
      setStreaming(null);

      api
        .listThreads()
        .then((result) => setThreads(result.threads))
        .catch(() => undefined);
    } catch (err) {
      setStreaming(null);
      const messageText = err instanceof Error ? err.message : "No se pudo enviar.";
      setSendError({ message: messageText, retryText: message, turnId });
      toast.error(messageText);
    } finally {
      setSending(false);
    }
  };

  const retryLastSend = async () => {
    if (!sendError || sending) return;
    if (activeId != null) {
      try {
        const thread = await api.getThread(activeId);
        const completed = thread.messages.find(
          (message) =>
            message.role === "assistant" && message.turnId === sendError.turnId,
        );
        // El servidor puede haber terminado después de que el navegador perdiera
        // el stream. Se recupera exactamente este turno, no cualquier respuesta.
        if (completed) {
          setMessages(
            thread.messages.map((message) => ({
              id: String(message.id),
              role: message.role,
              content: message.content,
              turnId: message.turnId,
            })),
          );
          setSendError(null);
          return;
        }
      } catch {
        // Si no se puede recuperar, el reintento normal conserva el error visible.
      }
    }
    await send(sendError.retryText, sendError.turnId);
  };

  const activeThread =
    activeId == null ? null : threads.find((thread) => thread.id === activeId) ?? null;

  const startWithPrompt = (prompt: string) => {
    newThread();
    void send(prompt);
  };

  if (view === "list") {
    return (
      <>
        <ThreadList
          threads={threads}
          nowIso={nowIso}
          onNew={newThread}
          onOpen={openThread}
          onRemove={setPendingDelete}
          onPrompt={startWithPrompt}
          online={online}
        />
        <ConfirmDialog
          open={pendingDelete != null}
          onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}
          title="Borrar conversación"
          description={
            pendingDelete
              ? `Se borrará «${pendingDelete.title}» y todos sus mensajes.`
              : ""
          }
          confirmLabel="Borrar conversación"
          busy={deleting}
          onConfirm={() => {
            if (pendingDelete) return removeThread(pendingDelete);
          }}
        />
      </>
    );
  }

  return (
    // Panel fijo: `top` bajo el header, `bottom` justo sobre la nav (o a 0 con el
    // teclado abierto). Altura definida → el composer se ancla abajo y los mensajes
    // scrollean dentro, sin depender del scroll del documento.
    <section
      ref={panelRef}
      className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-[560px] flex-col bg-background px-[18px] pt-2"
      style={{ top: panelTop, bottom: kbOpen ? 0 : "var(--nav-h)" }}
    >
      <div className="flex min-h-13 items-center gap-2 border-b border-line pb-2">
        <button
          type="button"
          onClick={backToList}
          aria-label="Volver a la lista"
          className="app-icon-button shrink-0"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-foreground">
            {activeId == null ? "Nueva conversación" : activeTitle ?? "Conversación"}
          </span>
          {activeThread ? (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">
              {relativeDate(activeThread.updatedAt, nowIso)} · {activeThread.messageCount}{" "}
              {activeThread.messageCount === 1 ? "mensaje" : "mensajes"}
            </span>
          ) : null}
        </span>
      </div>

      <MessageArea
        scrollRef={scrollRef}
        onScroll={onMessagesScroll}
        loadingThread={loadingThread}
        online={online}
        sending={sending}
        onSend={send}
        messages={messages}
        streaming={streaming}
        error={sendError}
        onRetry={retryLastSend}
        loadError={threadLoadError}
        onRetryLoad={() => {
          if (activeId != null) void openThread(activeId);
        }}
        onBack={backToList}
      />

      <Composer
        inputRef={inputRef}
        input={input}
        setInput={setInput}
        online={online}
        sending={sending}
        onSend={send}
      />
    </section>
  );
}

/** Vista de lista: hilos existentes o estado vacío, con "Nuevo". */
function ThreadList({
  threads,
  nowIso,
  onNew,
  onOpen,
  onRemove,
  onPrompt,
  online,
}: {
  threads: ThreadDTO[];
  nowIso: string;
  onNew: () => void;
  onOpen: (id: number) => void;
  onRemove: (thread: ThreadDTO) => void;
  onPrompt: (prompt: string) => void;
  online: boolean;
}) {
  const [managing, setManaging] = useState(false);

  return (
    <section className="space-y-7 pb-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="ui-label">Coach con tus datos</p>
          <h1 className="app-page-title mt-1">Chat</h1>
        </div>
        <button
          type="button"
          onClick={onNew}
          aria-label="Nueva conversación"
          className="app-icon-button shrink-0 border-primary/20 bg-primary text-primary-foreground hover:bg-primary-strong hover:text-primary-foreground"
        >
          <MessageSquarePlus className="size-[18px]" aria-hidden />
        </button>
      </div>

      <section
        className="rounded-[22px] bg-[var(--inverted)] p-5 text-[var(--on-inverted)] shadow-card"
        aria-labelledby="chat-welcome-title"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/25 text-[var(--on-inverted)]">
          <Sparkles className="size-5" strokeWidth={1.8} aria-hidden />
        </span>
        <h2
          id="chat-welcome-title"
          className="mt-5 max-w-[310px] font-display text-[24px] font-semibold leading-[1.18]"
        >
          ¿Qué quieres entender hoy?
        </h2>
        <p className="mt-2 max-w-[360px] text-[13px] leading-relaxed text-[var(--on-inverted-muted)]">
          Pregunta por tu dieta, el reparto de comidas, una carga, tu evolución o lo
          que muestran tus últimos días.
        </p>
        <p
          className="mt-4 flex items-center gap-2 text-[12px] font-semibold"
          style={{
            color:
              "color-mix(in srgb, var(--protein) 38%, var(--on-inverted))",
          }}
        >
          <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />
          Plan, salud y entrenamientos actualizados
        </p>
      </section>

      <section aria-labelledby="quick-prompts-title">
        <h2 id="quick-prompts-title" className="section-title">
          Preguntas rápidas
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {QUICK_PROMPTS.map(({ text, Icon, color }) => (
            <button
              key={text}
              type="button"
              disabled={!online}
              onClick={() => onPrompt(text)}
              className="wellness-card flex min-h-[112px] flex-col items-start justify-between border border-line p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary-soft/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon className="size-5" style={{ color }} strokeWidth={1.8} aria-hidden />
              <span className="mt-4 text-[13px] font-semibold leading-snug text-foreground">
                {text}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section aria-labelledby="thread-list-title">
        <div className="mb-3 flex min-h-11 items-center justify-between gap-3">
          <h2 id="thread-list-title" className="section-title">
            Conversaciones
          </h2>
          {threads.length > 0 ? (
            <button
              type="button"
              aria-pressed={managing}
              onClick={() => setManaging((value) => !value)}
              className="min-h-11 rounded-xl px-2 text-[13px] font-semibold text-primary"
            >
              {managing ? "Listo" : "Gestionar"}
            </button>
          ) : null}
        </div>

      {threads.length === 0 ? (
        <div className="wellness-card p-6 text-center ring-1 ring-dashed ring-line">
          <span className="mx-auto flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <MessageSquarePlus className="size-5" aria-hidden />
          </span>
          <p className="mt-4 text-[14px] font-semibold text-foreground">
            Todavía no hay conversaciones
          </p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Abre un hilo para consultar tu semana, comidas o progreso.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-primary px-4 text-[14px] font-semibold text-primary-foreground"
          >
            <MessageSquarePlus className="size-4" aria-hidden /> Nueva conversación
          </button>
        </div>
      ) : (
        <ul className="wellness-card divide-y divide-line overflow-hidden">
          {threads.map((thread) => (
            <li key={thread.id} className="flex min-h-[82px] items-center">
              <button
                type="button"
                onClick={() => onOpen(thread.id)}
                className="flex min-h-[82px] min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2/60"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <MessageCircle className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-foreground">
                    {thread.title}
                  </span>
                  {thread.preview ? (
                    <span className="mt-0.5 block truncate text-[12px] text-muted-foreground">
                      {thread.preview}
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="text-right text-[11px] text-muted-foreground">
                    {relativeDate(thread.updatedAt, nowIso)}
                  </span>
                  {!managing ? (
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  ) : null}
                </span>
              </button>
              {managing ? (
                <button
                  type="button"
                  aria-label={`Borrar conversación ${thread.title}`}
                  onClick={() => onRemove(thread)}
                  className="app-icon-button mr-2 shrink-0 border-0 bg-transparent text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
        <p className="mt-3 flex items-start gap-2 px-1 text-[11px] leading-relaxed text-muted-foreground">
          <Sparkles className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden />
          Los títulos resumen el tema del hilo; se generarán automáticamente con IA.
        </p>
      </section>
    </section>
  );
}

/** Área scrolleable de mensajes: loading, estado vacío con chips, burbujas y stream. */
function MessageArea({
  scrollRef,
  onScroll,
  loadingThread,
  online,
  sending,
  onSend,
  messages,
  streaming,
  error,
  onRetry,
  loadError,
  onRetryLoad,
  onBack,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  onScroll: () => void;
  loadingThread: boolean;
  online: boolean;
  sending: boolean;
  onSend: (text: string) => void;
  messages: UIMessage[];
  streaming: string | null;
  error: SendErrorState | null;
  onRetry: () => void;
  loadError: string | null;
  onRetryLoad: () => void;
  onBack: () => void;
}) {
  const empty =
    messages.length === 0 &&
    streaming == null &&
    !loadingThread &&
    loadError == null;
  return (
    <div
      ref={scrollRef}
      onScroll={onScroll}
      className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4"
    >
      {loadingThread ? (
        <div className="flex justify-center pt-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-label="Cargando conversación" />
        </div>
      ) : null}

      {loadError ? (
        <div
          className="wellness-card mt-4 flex items-start gap-3 p-4 ring-1 ring-destructive/30"
          role="alert"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              No se pudo abrir la conversación
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
              {loadError}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onRetryLoad}
                className="min-h-11 rounded-xl px-2 text-[12px] font-semibold text-primary"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={onBack}
                className="min-h-11 rounded-xl px-2 text-[12px] font-semibold text-muted-foreground"
              >
                Volver
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {empty ? (
        <div className="pt-4">
          <p className="text-[13px] text-muted-foreground">
            Empieza con una pregunta sobre tus datos:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.slice(0, 3).map(({ text: q }) => (
              <button
                key={q}
                type="button"
                disabled={!online || sending}
                onClick={() => onSend(q)}
                className="min-h-11 rounded-full border border-line bg-surface px-3 text-[13px] text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {messages.map((m) => (
        <Bubble key={m.id} role={m.role} content={m.content} />
      ))}
      {streaming != null ? (
        <Bubble role="assistant" content={streaming} streaming />
      ) : null}
      {error ? (
        <div className="wellness-card flex items-start gap-3 p-4 ring-1 ring-destructive/30" role="alert">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertCircle className="size-[18px]" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold text-foreground">
              No se pudo completar la respuesta
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {error.message}
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 min-h-11 rounded-xl px-1 text-[12px] font-semibold text-primary"
            >
              Reintentar respuesta
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Composer: textarea + botón enviar + contador de tope + aviso sin conexión. */
function Composer({
  inputRef,
  input,
  setInput,
  online,
  sending,
  onSend,
}: {
  inputRef: RefObject<HTMLTextAreaElement | null>;
  input: string;
  setInput: (v: string) => void;
  online: boolean;
  sending: boolean;
  onSend: (text: string) => void;
}) {
  const over = input.length - CHAT_MAX_CHARS; // > 0 si se pasa del tope
  const tooLong = over > 0;
  const nearLimit = input.length > CHAT_MAX_CHARS * 0.9;

  return (
    <div className="border-t border-line pt-3 pb-2">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // En móvil Enter = salto de línea (respuestas multilínea); se envía
          // SOLO con el botón. Antes Enter enviaba y no dejaba escribir párrafos.
          rows={2}
          placeholder={online ? "Pregunta sobre tus datos…" : "Sin conexión"}
          disabled={!online || sending}
          className="max-h-40 min-h-11 flex-1 resize-none rounded-xl border border-input bg-surface px-3 py-2.5 text-base outline-none focus-visible:border-ring disabled:opacity-60"
        />
        <button
          type="button"
          onClick={() => onSend(input)}
          disabled={!online || sending || !input.trim() || tooLong}
          aria-label="Enviar"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden />
          ) : (
            <Send className="size-5" aria-hidden />
          )}
        </button>
      </div>
      {tooLong ? (
        <p className="mt-1.5 text-[12px] font-medium text-destructive" role="alert">
          Mensaje demasiado largo: quita {over.toLocaleString("es-ES")} caracter
          {over === 1 ? "" : "es"} ({input.length.toLocaleString("es-ES")}/
          {CHAT_MAX_CHARS.toLocaleString("es-ES")}).
        </p>
      ) : nearLimit ? (
        <p className="mt-1.5 text-right text-[12px] text-muted-foreground">
          {input.length.toLocaleString("es-ES")}/
          {CHAT_MAX_CHARS.toLocaleString("es-ES")}
        </p>
      ) : null}
      {!online ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <WifiOff className="size-3.5" aria-hidden /> Sin conexión: el chat necesita
          red.
        </p>
      ) : null}
    </div>
  );
}

function Bubble({
  role,
  content,
  streaming,
}: {
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("No se pudo copiar.");
    }
  };

  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed",
          isUser
            ? "bg-primary whitespace-pre-wrap text-primary-foreground"
            : "bg-surface text-foreground shadow-card ring-1 ring-line",
        )}
      >
        {isUser || streaming ? (
          <span className="whitespace-pre-wrap">{content || (streaming ? "…" : "")}</span>
        ) : (
          <Markdown text={content} className="space-y-2" />
        )}
        {!isUser && !streaming && content ? (
          <button
            type="button"
            onClick={copy}
            className="mt-1 flex min-h-11 items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <Check className="size-3.5 text-protein" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
            {copied ? "Copiado" : "Copiar"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
