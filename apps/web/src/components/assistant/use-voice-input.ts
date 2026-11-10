"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MAX_RECORDING_BYTES,
  MAX_RECORDING_MS,
  MIN_RECORDING_MS,
  RECORDING_BITS_PER_SECOND,
  SPEECH_LANG,
} from "@/lib/assistant/constants";
import { assistantErrorMessage, transcribeAudio } from "@/lib/assistant/api";
import {
  detectVoiceCapabilities,
  getSpeechRecognitionCtor,
  isPermissionError,
  isSpeechServiceFailure,
  pickRecorderMimeType,
  readRecognitionResults,
  selectVoicePath,
  type SpeechRecognitionLike,
  type VoiceCapabilities,
} from "@/lib/assistant/speech";

export type VoiceState = "idle" | "listening" | "recording" | "transcribing";

interface Options {
  /** Final text, ready to send. */
  onTranscript: (text: string) => void;
  /** Live partial text while the browser recognizer listens. */
  onInterim?: (text: string) => void;
  onError: (message: string) => void;
}

const PERMISSION_MESSAGE =
  "No tengo permiso para usar tu micrófono. Actívalo en la configuración del navegador o escríbeme tu búsqueda.";
const NO_SPEECH_MESSAGE = "No te escuché. Toca el micrófono e inténtalo de nuevo.";

const NO_CAPABILITIES: VoiceCapabilities = {
  speechRecognition: false,
  mediaRecorder: false,
  getUserMedia: false,
};

export function useVoiceInput({ onTranscript, onInterim, onError }: Options) {
  const callbacks = useRef({ onTranscript, onInterim, onError });
  callbacks.current = { onTranscript, onInterim, onError };

  const [caps] = useState<VoiceCapabilities>(() =>
    typeof window === "undefined" ? NO_CAPABILITIES : detectVoiceCapabilities(window),
  );
  // Set when the free recognizer fails at the service level (offline engine,
  // blocked by policy): from then on this session uses the recorder.
  const [speechFailed, setSpeechFailed] = useState(false);
  const path = selectVoicePath(caps, { speechFailed });

  const [state, setState] = useState<VoiceState>("idle");
  const [elapsedMs, setElapsedMs] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<{ stop?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});
  const abortRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);

  const clearTimers = () => {
    if (timersRef.current.stop) clearTimeout(timersRef.current.stop);
    if (timersRef.current.tick) clearInterval(timersRef.current.tick);
    timersRef.current = {};
  };

  const releaseStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startRecorder = useCallback(async () => {
    cancelledRef.current = false;
    const mimeType = pickRecorderMimeType(
      typeof MediaRecorder !== "undefined" ? MediaRecorder.isTypeSupported?.bind(MediaRecorder) : undefined,
    );
    if (mimeType === null) {
      callbacks.current.onError("Tu navegador no puede grabar notas de voz. Escríbeme tu búsqueda.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
    } catch (err) {
      callbacks.current.onError(
        isPermissionError(err)
          ? PERMISSION_MESSAGE
          : "No encontré un micrófono disponible. Escríbeme tu búsqueda.",
      );
      return;
    }
    if (cancelledRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: RECORDING_BITS_PER_SECOND,
      });
    } catch {
      releaseStream();
      callbacks.current.onError("Tu navegador no puede grabar notas de voz. Escríbeme tu búsqueda.");
      return;
    }
    recorderRef.current = recorder;

    const chunks: Blob[] = [];
    let bytes = 0;
    const startedAt = Date.now();

    recorder.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      chunks.push(e.data);
      bytes += e.data.size;
      if (bytes >= MAX_RECORDING_BYTES && recorder.state === "recording") recorder.stop();
    };

    recorder.onstop = async () => {
      clearTimers();
      releaseStream();
      recorderRef.current = null;
      setElapsedMs(0);
      if (cancelledRef.current) {
        setState("idle");
        return;
      }
      if (Date.now() - startedAt < MIN_RECORDING_MS || bytes === 0) {
        setState("idle");
        callbacks.current.onError("La nota fue muy corta. Toca el micrófono, habla y vuelve a tocarlo para enviar.");
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
      setState("transcribing");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const text = await transcribeAudio(blob, controller.signal);
        if (controller.signal.aborted) return;
        if (text) callbacks.current.onTranscript(text);
        else callbacks.current.onError(NO_SPEECH_MESSAGE);
      } catch (err) {
        if (controller.signal.aborted) return;
        callbacks.current.onError(assistantErrorMessage(err, "voice"));
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        if (!controller.signal.aborted) setState("idle");
      }
    };

    recorder.start(1000);
    setState("recording");
    setElapsedMs(0);
    timersRef.current.stop = setTimeout(() => {
      if (recorder.state === "recording") recorder.stop();
    }, MAX_RECORDING_MS);
    timersRef.current.tick = setInterval(() => setElapsedMs(Date.now() - startedAt), 250);
  }, []);

  const startRecognition = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor(window);
    if (!Ctor) return false;
    cancelledRef.current = false;
    let recognition: SpeechRecognitionLike;
    try {
      recognition = new Ctor();
    } catch {
      return false;
    }
    recognition.lang = SPEECH_LANG;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let finalText = "";
    let failure: string | null = null;

    recognition.onresult = (event) => {
      const { final, interim } = readRecognitionResults(event);
      finalText = final;
      callbacks.current.onInterim?.([final, interim].filter(Boolean).join(" "));
    };
    recognition.onerror = (event) => {
      failure = event.error;
    };
    recognition.onend = () => {
      recognitionRef.current = null;
      setState("idle");
      if (cancelledRef.current) return;
      if (failure && isSpeechServiceFailure(failure)) {
        // The free engine can't serve this browser: switch to the recorder
        // for the rest of the session and keep going — the user wanted to talk.
        setSpeechFailed(true);
        if (caps.mediaRecorder && caps.getUserMedia) {
          void startRecorder();
        } else {
          callbacks.current.onError("El dictado no está disponible en este navegador. Escríbeme tu búsqueda.");
        }
        return;
      }
      if (failure && isPermissionError(failure)) {
        callbacks.current.onError(PERMISSION_MESSAGE);
        return;
      }
      if (finalText) {
        callbacks.current.onTranscript(finalText);
        return;
      }
      if (failure !== "aborted") callbacks.current.onError(NO_SPEECH_MESSAGE);
    };

    try {
      recognition.start();
    } catch {
      return false;
    }
    recognitionRef.current = recognition;
    setState("listening");
    return true;
  }, [caps, startRecorder]);

  const start = useCallback(() => {
    if (state !== "idle") return;
    if (path === "speech") {
      if (startRecognition()) return;
      setSpeechFailed(true);
      if (caps.mediaRecorder && caps.getUserMedia) void startRecorder();
      return;
    }
    if (path === "recorder") void startRecorder();
  }, [state, path, caps, startRecognition, startRecorder]);

  /** Finish and send what was said. */
  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    const recorder = recorderRef.current;
    if (recorder && recorder.state === "recording") recorder.stop();
  }, []);

  /** Drop everything (panel closed, new search). */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    recognitionRef.current?.abort();
    recognitionRef.current = null;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
    clearTimers();
    releaseStream();
    setElapsedMs(0);
    setState("idle");
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    available: path !== "none",
    path,
    state,
    elapsedMs,
    start,
    stop,
    cancel,
  };
}
