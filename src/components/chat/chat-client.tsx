"use client";

import {
  ArrowLeft,
  Check,
  Copy,
  Loader2,
  MessageSquarePlus,
  Send,
  Trash2,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Markdown } from "@/components/ui/markdown";
import { api } from "@/lib/client-api";
import { CHAT_MAX_CHARS } from "@/lib/schemas";
import { useKeyboardOpen } from "@/lib/use-keyboard-open";
import { useOnline } from "@/lib/use-online";
import { cn } from "@/lib/utils";
import type { MessageDTO, ThreadDTO } from "@/server/db/queries/chat";

/*
  Chat sobre tus datos (F-IA-8). Hilos persistentes, streaming, chips de preguntas
  sugeridas al abrir un hilo vacío, copiar por mensaje. Guardarraíles (principio 8)
  viven en el system prompt del servidor: la IA observa y explica, no prescribe.
  Sin conexión: composición deshabilitada con motivo (07 §4).
*/
const SUGGESTED = [
  "¿Cómo va mi semana?",
  "¿Qué me hincha?",
  "Compara mis dos últimas cargas",
];

interface UIMessage extends Omit<MessageDTO, "id" | "createdAt"> {
  id: string;
}

let tmp = 0;
const tmpId = () => `t${tmp++}`;

export function ChatClient({
  initialThreads,
  initialThreadId = null,
}: {
  initialThreads: ThreadDTO[];
  initialThreadId?: number | null;
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
  const scrollToBottom = () => {
    // Doble rAF: el markdown reajusta su alto tras montar, así que medimos
    // scrollHeight un frame después del layout; si no, al abrir un hilo se
    // quedaba a media altura.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    });
  };
  useEffect(scrollToBottom, [messages, streaming]);

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

  // Puente Coach → Chat (F01 Fase 2): al entrar con ?thread=<id>, abre ese hilo
  // (sembrado con la pregunta + la respuesta del coach) y enfoca el input.
  const openedRef = useRef(false);
  useEffect(() => {
    if (initialThreadId == null || openedRef.current) return;
    openedRef.current = true;
    openThread(initialThreadId).then(() => inputRef.current?.focus());
  }, [initialThreadId]);

  const openThread = async (id: number) => {
    setActiveId(id);
    setView("thread");
    setMessages([]);
    setStreaming(null);
    setLoadingThread(true);
    try {
      const t = await api.getThread(id);
      setMessages(
        t.messages.map((m) => ({ id: String(m.id), role: m.role, content: m.content })),
      );
      scrollToBottom();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo abrir el hilo.");
    } finally {
      setLoadingThread(false);
    }
  };

  const newThread = () => {
    setActiveId(null);
    setView("thread");
    setMessages([]);
    setStreaming(null);
    setInput("");
  };

  const backToList = () => {
    setView("list");
    setActiveId(null);
  };

  const removeThread = async (id: number) => {
    if (!window.confirm("¿Borrar este hilo de conversación?")) return;
    const prev = threads;
    setThreads((ts) => ts.filter((t) => t.id !== id));
    try {
      await api.deleteThread(id);
    } catch (err) {
      setThreads(prev);
      toast.error(err instanceof Error ? err.message : "No se pudo borrar.");
    }
  };

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    if (message.length > CHAT_MAX_CHARS) {
      toast.error(`Mensaje demasiado largo (máx. ${CHAT_MAX_CHARS} caracteres).`);
      return;
    }
    setInput("");
    setMessages((m) => [...m, { id: tmpId(), role: "user", content: message }]);
    setStreaming("");
    setSending(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeId, message }),
      });
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

      const headerId = res.headers.get("X-Thread-Id");
      const newId = headerId ? Number(headerId) : null;

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

      setMessages((m) => [...m, { id: tmpId(), role: "assistant", content: acc }]);
      setStreaming(null);

      if (newId != null && activeId == null) {
        setActiveId(newId);
        // Refresca la lista de hilos (título recién creado, orden por uso).
        api
          .listThreads()
          .then((r) => setThreads(r.threads))
          .catch(() => {});
      }
    } catch (err) {
      setStreaming(null);
      toast.error(err instanceof Error ? err.message : "No se pudo enviar.");
    } finally {
      setSending(false);
    }
  };

  if (view === "list") {
    return (
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="card-title text-muted-foreground">Chat</h1>
          <button
            type="button"
            onClick={newThread}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-[13px] font-semibold text-primary-foreground"
          >
            <MessageSquarePlus className="size-4" aria-hidden /> Nuevo
          </button>
        </div>

        {threads.length === 0 ? (
          <div className="rounded-xl border border-dashed border-line bg-surface-2 p-6 text-center">
            <p className="text-[14px] text-foreground">
              Pregúntale a tus datos: tu semana, qué te hincha, comparar cargas…
            </p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Observa y explica con tus cifras; no prescribe dieta (eso es la visita).
            </p>
            <button
              type="button"
              onClick={newThread}
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground"
            >
              <MessageSquarePlus className="size-4" aria-hidden /> Nueva conversación
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
            {threads.map((t) => (
              <li key={t.id} className="flex items-center gap-2 px-4 py-3">
                <button
                  type="button"
                  onClick={() => openThread(t.id)}
                  className="min-w-0 flex-1 truncate text-left text-[14px] text-foreground"
                >
                  {t.title}
                </button>
                <button
                  type="button"
                  aria-label="Borrar hilo"
                  onClick={() => removeThread(t.id)}
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  const empty = messages.length === 0 && streaming == null && !loadingThread;
  const over = input.length - CHAT_MAX_CHARS; // > 0 si se pasa del tope
  const tooLong = over > 0;
  const nearLimit = input.length > CHAT_MAX_CHARS * 0.9;

  return (
    // Panel fijo: `top` bajo el header, `bottom` justo sobre la nav (o a 0 con el
    // teclado abierto). Altura definida → el composer se ancla abajo y los mensajes
    // scrollean dentro, sin depender del scroll del documento.
    <section
      ref={panelRef}
      className="fixed inset-x-0 z-10 mx-auto flex w-full max-w-[560px] flex-col bg-background px-4 pt-2"
      style={{ top: panelTop, bottom: kbOpen ? 0 : "var(--nav-h)" }}
    >
      <div className="flex items-center gap-2 pb-2">
        <button
          type="button"
          onClick={backToList}
          aria-label="Volver a la lista"
          className="inline-flex size-8 items-center justify-center rounded-lg border border-line bg-surface text-muted-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <span className="text-[13px] font-semibold text-foreground">
          {activeId == null ? "Nueva conversación" : "Conversación"}
        </span>
      </div>

      <div
        ref={scrollRef}
        onScroll={onMessagesScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-3"
      >
        {loadingThread ? (
          <div className="flex justify-center pt-8 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" aria-label="Cargando conversación" />
          </div>
        ) : null}

        {empty ? (
          <div className="pt-4">
            <p className="text-[13px] text-muted-foreground">
              Empieza con una pregunta sobre tus datos:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {SUGGESTED.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!online || sending}
                  onClick={() => send(q)}
                  className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
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
      </div>

      <div className="border-t border-line pt-2 pb-2">
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
            onClick={() => send(input)}
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
    </section>
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
            : "border border-line bg-surface text-foreground",
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
            className="mt-2 flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
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
