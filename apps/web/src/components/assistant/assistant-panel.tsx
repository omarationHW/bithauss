"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import {
  AlertCircle,
  Loader2,
  Mic,
  RotateCcw,
  SendHorizontal,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASSISTANT_GREETING,
  ASSISTANT_NAME,
  CONVERSATION_STORAGE_KEY,
  EXAMPLE_PROMPTS,
  MAX_MESSAGE_CHARS,
  MAX_RECORDING_MS,
  SPEAK_REPLIES_STORAGE_KEY,
  SPEECH_LANG,
} from "@/lib/assistant/constants";
import { assistantErrorMessage, sendChat } from "@/lib/assistant/api";
import {
  loadConversation,
  newMessageId,
  saveConversation,
  toRequestMessages,
  truncateMessage,
  type ConversationMessage,
} from "@/lib/assistant/history";
import { pickSpanishVoice, speakableText } from "@/lib/assistant/speech";
import { PropertyHitCard } from "./property-hit-card";
import { useVoiceInput } from "./use-voice-input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes back on close (the floating button). */
  returnFocusRef: RefObject<HTMLElement | null>;
}

interface PanelError {
  message: string;
  /** Text to resend with "Reintentar" (chat failures only). */
  retryText?: string;
}

function safeSessionStorage(): Storage | undefined {
  try {
    return window.sessionStorage;
  } catch {
    return undefined;
  }
}

function readSpeakPreference(): boolean {
  try {
    return window.localStorage.getItem(SPEAK_REPLIES_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeSpeakPreference(on: boolean) {
  try {
    window.localStorage.setItem(SPEAK_REPLIES_STORAGE_KEY, on ? "1" : "0");
  } catch {
    /* preference just won't be remembered */
  }
}

function formatClock(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const RESET_REASON = "reset";

const iconButton =
  "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

export default function AssistantPanel({ open, onOpenChange, returnFocusRef }: Props) {
  const [messages, setMessages] = useState<ConversationMessage[]>(() =>
    loadConversation(safeSessionStorage(), CONVERSATION_STORAGE_KEY),
  );
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<PanelError | null>(null);

  const ttsSupported = typeof window !== "undefined" && "speechSynthesis" in window;
  const [speakReplies, setSpeakReplies] = useState(() => ttsSupported && readSpeakPreference());

  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const counterId = useId();

  const tooLong = input.length > MAX_MESSAGE_CHARS;

  // ── Persistence ───────────────────────────────────────────────────────
  useEffect(() => {
    saveConversation(safeSessionStorage(), CONVERSATION_STORAGE_KEY, messages);
  }, [messages]);

  // ── Spoken replies (free speechSynthesis only) ────────────────────────
  const stopSpeaking = useCallback(() => {
    try {
      if (ttsSupported) window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }, [ttsSupported]);

  const speak = useCallback(
    (text: string) => {
      if (!ttsSupported || !speakReplies) return;
      const spoken = speakableText(text);
      if (!spoken) return;
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(spoken);
        utterance.lang = SPEECH_LANG;
        const voice = pickSpanishVoice(synth.getVoices());
        if (voice) utterance.voice = voice;
        synth.speak(utterance);
      } catch {
        /* no voice available: the text is on screen anyway */
      }
    },
    [ttsSupported, speakReplies],
  );

  useEffect(() => {
    // Some browsers load voices lazily; touching getVoices() starts it.
    if (!ttsSupported) return;
    try {
      window.speechSynthesis.getVoices();
    } catch {
      /* ignore */
    }
  }, [ttsSupported]);

  const toggleSpeak = () => {
    const next = !speakReplies;
    setSpeakReplies(next);
    writeSpeakPreference(next);
    if (!next) stopSpeaking();
  };

  // ── Chat ──────────────────────────────────────────────────────────────
  const send = useCallback(
    async (raw: string) => {
      const content = raw.trim();
      if (!content || pending || content.length > MAX_MESSAGE_CHARS) return;

      const userMessage: ConversationMessage = { id: newMessageId(), role: "user", content };
      const next = [...messages, userMessage];
      setMessages(next);
      setInput("");
      setError(null);
      setPending(true);
      stopSpeaking();

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await sendChat(toRequestMessages(next), controller.signal);
        if (controller.signal.aborted) return;
        setMessages((current) => [
          ...current,
          {
            id: newMessageId(),
            role: "assistant",
            content: response.reply,
            properties: response.properties,
            relaxed: response.relaxed,
          },
        ]);
        speak(response.reply);
      } catch (err) {
        // Roll the unanswered turn back so the history the API sees stays
        // user/assistant alternating; the text goes back to the box.
        // "Nueva búsqueda" wipes the turn on purpose: nothing to restore.
        if (controller.signal.reason === RESET_REASON) return;
        setMessages((current) => current.filter((m) => m.id !== userMessage.id));
        setInput((current) => current || content);
        if (!controller.signal.aborted) {
          setError({ message: assistantErrorMessage(err, "chat"), retryText: content });
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setPending(false);
      }
    },
    [messages, pending, speak, stopSpeaking],
  );

  // ── Voice input ───────────────────────────────────────────────────────
  const voice = useVoiceInput({
    onInterim: (text) => setInput(truncateMessage(text)),
    onTranscript: (text) => {
      const clean = truncateMessage(text.trim());
      setInput(clean);
      void send(clean);
    },
    onError: (message) => setError({ message }),
  });
  const voiceBusy = voice.state !== "idle";

  const toggleMic = () => {
    if (voice.state === "listening" || voice.state === "recording") {
      voice.stop();
      return;
    }
    if (voice.state !== "idle" || pending) return;
    stopSpeaking();
    setError(null);
    voice.start();
  };

  // ── Lifecycle: closing aborts everything in flight ────────────────────
  const { cancel: cancelVoice } = voice;
  useEffect(() => {
    if (open) return;
    abortRef.current?.abort();
    abortRef.current = null;
    cancelVoice();
    stopSpeaking();
  }, [open, cancelVoice, stopSpeaking]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      stopSpeaking();
    },
    [stopSpeaking],
  );

  const reset = () => {
    abortRef.current?.abort(RESET_REASON);
    abortRef.current = null;
    voice.cancel();
    stopSpeaking();
    setMessages([]);
    setInput("");
    setError(null);
    setPending(false);
    textareaRef.current?.focus();
  };

  // ── Scrolling: show the start of each new reply, not the last card ────
  useEffect(() => {
    if (!open) return;
    const last = messages[messages.length - 1];
    const frame = requestAnimationFrame(() => {
      // Scroll the log only — scrollIntoView would also scroll the dialog
      // container and push the header out of view.
      const log = logRef.current;
      if (!log) return;
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      const top =
        last?.role === "assistant" && lastMessageRef.current
          ? lastMessageRef.current.offsetTop - 16
          : log.scrollHeight;
      log.scrollTo?.({ top, behavior: reduceMotion ? "auto" : "smooth" });
    });
    return () => cancelAnimationFrame(frame);
  }, [messages, pending, error, open]);

  // Grow the textarea with its content, up to ~5 lines.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input, open]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  };

  const closePanel = () => onOpenChange(false);

  const canSend = !!input.trim() && !tooLong && !pending && !voiceBusy;
  const recording = voice.state === "recording";
  const listening = voice.state === "listening";

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/40 md:bg-black/15" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // On touch screens don't pop the keyboard over the greeting.
            if (window.matchMedia?.("(pointer: fine)").matches) {
              e.preventDefault();
              textareaRef.current?.focus();
            }
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            returnFocusRef.current?.focus();
          }}
          className={cn(
            "fixed inset-0 z-[61] flex flex-col bg-background text-foreground outline-none",
            "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
            "md:inset-auto md:bottom-6 md:right-6 md:h-[min(680px,calc(100dvh-3rem))] md:w-[400px] md:overflow-hidden md:rounded-2xl md:border md:border-border md:pt-0 md:pb-0 md:shadow-2xl",
            "animate-fade-in-up motion-reduce:animate-none",
          )}
        >
          {/* Header */}
          <header className="flex items-center gap-3 border-b border-border px-4 py-3">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-white"
            >
              <Sparkles className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="truncate text-base font-semibold leading-tight">
                {ASSISTANT_NAME}
              </DialogPrimitive.Title>
              <p className="truncate text-xs text-muted-foreground">Te ayudo a encontrar tu propiedad</p>
            </div>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={reset}
                aria-label="Nueva búsqueda"
                title="Nueva búsqueda"
                className={iconButton}
              >
                <RotateCcw className="h-5 w-5" aria-hidden />
              </button>
            )}
            {ttsSupported && (
              <button
                type="button"
                onClick={toggleSpeak}
                aria-pressed={speakReplies}
                aria-label="Leer respuestas en voz alta"
                title={speakReplies ? "Respuestas en voz alta: activadas" : "Respuestas en voz alta: desactivadas"}
                className={cn(iconButton, speakReplies && "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary")}
              >
                {speakReplies ? <Volume2 className="h-5 w-5" aria-hidden /> : <VolumeX className="h-5 w-5" aria-hidden />}
              </button>
            )}
            <DialogPrimitive.Close className={iconButton} aria-label="Cerrar asistente">
              <X className="h-5 w-5" aria-hidden />
            </DialogPrimitive.Close>
          </header>

          {/* Conversation */}
          <div
            ref={logRef}
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversación"
            className="relative min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4"
          >
            <AssistantBubble>{ASSISTANT_GREETING}</AssistantBubble>

            {messages.length === 0 && !pending && (
              <div className="space-y-2 pl-1">
                <p className="text-xs font-medium text-muted-foreground">Prueba con:</p>
                <ul className="flex flex-col items-start gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <li key={prompt}>
                      <button
                        type="button"
                        onClick={() => void send(prompt)}
                        className="rounded-full border border-primary/30 bg-primary/5 px-3.5 py-2 text-left text-sm text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      >
                        {prompt}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {messages.map((message, index) => {
              const isLast = index === messages.length - 1;
              if (message.role === "user") {
                return (
                  <div key={message.id} ref={isLast ? lastMessageRef : undefined} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[15px] leading-relaxed text-primary-foreground">
                      <span className="sr-only">Tú: </span>
                      {message.content}
                    </p>
                  </div>
                );
              }
              const hits = message.properties ?? [];
              return (
                <div key={message.id} ref={isLast ? lastMessageRef : undefined} className="space-y-2.5">
                  <AssistantBubble>{message.content}</AssistantBubble>
                  {hits.length > 0 && (
                    <div className="space-y-2.5">
                      {message.relaxed && (
                        <p className="text-xs font-medium text-muted-foreground">
                          Resultados parecidos · no encontré coincidencias exactas
                        </p>
                      )}
                      <ul className="space-y-2.5" aria-label={`${hits.length} propiedades`}>
                        {hits.map((hit) => (
                          <li key={hit.id}>
                            <PropertyHitCard hit={hit} onNavigate={closePanel} />
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}

            {pending && (
              <div className="flex items-center gap-2" role="status">
                <span className="inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-muted px-4 py-3.5" aria-hidden>
                  {[0, 150, 300].map((delay) => (
                    <span
                      key={delay}
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/70 motion-reduce:animate-none"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </span>
                <span className="sr-only">{ASSISTANT_NAME} está buscando…</span>
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-foreground"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden />
                <div className="flex-1">
                  <p>{error.message}</p>
                  {error.retryText && (
                    <button
                      type="button"
                      onClick={() => void send(error.retryText!)}
                      disabled={pending}
                      className="mt-1 rounded text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Reintentar
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Composer */}
          <form onSubmit={onSubmit} className="border-t border-border bg-background px-3 pb-3 pt-2.5">
            {recording || voice.state === "transcribing" ? (
              <div className="flex items-center gap-2">
                <div
                  className="flex h-11 flex-1 items-center gap-2 rounded-2xl border border-border bg-muted/50 px-3.5 text-sm"
                  role="status"
                >
                  {recording ? (
                    <>
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden />
                      <span>Grabando…</span>
                      <span className="ml-auto tabular-nums text-muted-foreground">
                        {formatClock(voice.elapsedMs)} / {formatClock(MAX_RECORDING_MS)}
                      </span>
                    </>
                  ) : (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden />
                      <span>Transcribiendo tu nota…</span>
                    </>
                  )}
                </div>
                {recording ? (
                  <>
                    <button type="button" onClick={voice.cancel} className={iconButton} aria-label="Descartar nota de voz">
                      <X className="h-5 w-5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={voice.stop}
                      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-destructive text-white transition-colors hover:bg-destructive/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                      aria-label="Terminar y enviar nota de voz"
                    >
                      <Square className="h-4 w-4 fill-current" aria-hidden />
                    </button>
                  </>
                ) : (
                  <button type="button" onClick={voice.cancel} className={iconButton} aria-label="Cancelar transcripción">
                    <X className="h-5 w-5" aria-hidden />
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-end gap-2">
                <label htmlFor="assistant-input" className="sr-only">
                  Escribe qué propiedad buscas
                </label>
                <textarea
                  id="assistant-input"
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  readOnly={listening}
                  placeholder={listening ? "Te escucho…" : "Ej. casa con jardín en Coyoacán"}
                  aria-invalid={tooLong || undefined}
                  aria-describedby={counterId}
                  enterKeyHint="send"
                  className={cn(
                    "max-h-[140px] min-h-11 flex-1 resize-none rounded-2xl border border-input bg-background px-3.5 py-2.5 text-base leading-snug text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    tooLong && "border-destructive focus-visible:ring-destructive",
                  )}
                />
                {voice.available && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    disabled={pending}
                    aria-pressed={listening}
                    aria-label={listening ? "Dejar de escuchar y enviar" : "Hablar: dicta tu búsqueda"}
                    className={cn(
                      iconButton,
                      "h-11 w-11",
                      listening && "animate-pulse bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive motion-reduce:animate-none",
                    )}
                  >
                    {listening ? <Square className="h-4 w-4 fill-current" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!canSend}
                  aria-label="Enviar mensaje"
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40"
                >
                  {pending ? (
                    <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
                  ) : (
                    <SendHorizontal className="h-5 w-5" aria-hidden />
                  )}
                </button>
              </div>
            )}
            <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[11px] text-muted-foreground">
              <span>Puede equivocarse: confirma los detalles en cada propiedad.</span>
              <span
                id={counterId}
                className={cn("shrink-0 tabular-nums", tooLong && "font-semibold text-destructive")}
                aria-live={tooLong ? "polite" : "off"}
              >
                {tooLong
                  ? `Máximo ${MAX_MESSAGE_CHARS} caracteres (${input.length})`
                  : input.length > MAX_MESSAGE_CHARS * 0.7
                    ? `${input.length}/${MAX_MESSAGE_CHARS}`
                    : ""}
              </span>
            </div>
          </form>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex justify-start">
      <p className="max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md bg-muted px-3.5 py-2.5 text-[15px] leading-relaxed text-foreground">
        <span className="sr-only">{ASSISTANT_NAME}: </span>
        {children}
      </p>
    </div>
  );
}
