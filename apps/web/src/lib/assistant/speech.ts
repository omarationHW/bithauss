/**
 * Voice in and out for the assistant, cheapest path first.
 *
 * Input:
 *   1. "speech": the browser's own SpeechRecognition (free for us).
 *   2. "recorder": MediaRecorder + POST /assistant/transcribe (paid per call),
 *      only when (1) is missing or fails at the service level.
 *   3. "none": hide the mic.
 * Output: speechSynthesis only. Never a paid TTS.
 */

/** Minimal typing of the Web Speech API (not in lib.dom for every TS version). */
export interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResultLike };
}
export interface SpeechRecognitionErrorEventLike {
  error: string;
}
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
export type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type VoiceInputPath = "speech" | "recorder" | "none";

export interface VoiceCapabilities {
  speechRecognition: boolean;
  mediaRecorder: boolean;
  getUserMedia: boolean;
}

export function selectVoicePath(
  caps: VoiceCapabilities,
  opts: { speechFailed?: boolean } = {},
): VoiceInputPath {
  if (caps.speechRecognition && !opts.speechFailed) return "speech";
  if (caps.mediaRecorder && caps.getUserMedia) return "recorder";
  return "none";
}

type VoiceWindow = {
  SpeechRecognition?: SpeechRecognitionCtor;
  webkitSpeechRecognition?: SpeechRecognitionCtor;
  MediaRecorder?: unknown;
  isSecureContext?: boolean;
  navigator?: { mediaDevices?: { getUserMedia?: unknown } };
};

export function getSpeechRecognitionCtor(win: unknown): SpeechRecognitionCtor | null {
  const w = win as VoiceWindow | undefined;
  return w?.SpeechRecognition ?? w?.webkitSpeechRecognition ?? null;
}

export function detectVoiceCapabilities(win: unknown): VoiceCapabilities {
  const w = win as VoiceWindow | undefined;
  // Both paths need a secure context (https or localhost) for the mic.
  const secure = w?.isSecureContext !== false;
  return {
    speechRecognition: secure && !!getSpeechRecognitionCtor(w),
    mediaRecorder: secure && typeof w?.MediaRecorder === "function",
    getUserMedia: secure && typeof w?.navigator?.mediaDevices?.getUserMedia === "function",
  };
}

/**
 * SpeechRecognition errors that mean "the free engine can't serve us here"
 * (offline engine, blocked by browser policy, no es-MX) — worth falling back
 * to the recorder. Permission denial and silence are NOT: the recorder would
 * hit the same wall or there was simply nothing said.
 */
const SPEECH_SERVICE_ERRORS = new Set([
  "network",
  "service-not-allowed",
  "language-not-supported",
  "bad-grammar",
]);

export function isSpeechServiceFailure(error: string): boolean {
  return SPEECH_SERVICE_ERRORS.has(error);
}

export function isPermissionError(error: unknown): boolean {
  if (typeof error === "string") return error === "not-allowed";
  if (error && typeof error === "object" && "name" in error) {
    const name = (error as { name: string }).name;
    return name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError";
  }
  return false;
}

/** Recorder formats the API accepts, best compression first. */
export const RECORDER_MIME_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4",
  "audio/mpeg",
] as const;

/** First supported candidate, "" to let the browser choose, null if none. */
export function pickRecorderMimeType(
  isTypeSupported: ((type: string) => boolean) | undefined,
): string | null {
  if (typeof isTypeSupported !== "function") return "";
  for (const type of RECORDER_MIME_CANDIDATES) {
    try {
      if (isTypeSupported(type)) return type;
    } catch {
      /* some browsers throw on unknown types */
    }
  }
  return null;
}

/** Collects final + interim text of a recognition session. */
export function readRecognitionResults(event: SpeechRecognitionEventLike): {
  final: string;
  interim: string;
} {
  let final = "";
  let interim = "";
  for (let i = 0; i < event.results.length; i++) {
    const result = event.results[i]!;
    const text = result[0]?.transcript ?? "";
    if (result.isFinal) final += text;
    else interim += text;
  }
  return { final: final.trim(), interim: interim.trim() };
}

export interface VoiceLike {
  lang: string;
  name: string;
  localService?: boolean;
}

/** es-MX first, then Latin-American/US Spanish, then any Spanish. */
export function pickSpanishVoice<V extends VoiceLike>(voices: readonly V[]): V | null {
  const norm = (lang: string) => lang.replace("_", "-").toLowerCase();
  const ranked: ((lang: string) => boolean)[] = [
    (l) => l === "es-mx",
    (l) => l === "es-419" || l === "es-us",
    (l) => l.startsWith("es-") && l !== "es-es",
    (l) => l === "es" || l.startsWith("es-"),
  ];
  for (const test of ranked) {
    const matches = voices.filter((v) => test(norm(v.lang)));
    if (matches.length) return matches.find((v) => v.localService) ?? matches[0]!;
  }
  return null;
}

/** Text worth reading aloud: no URLs, markdown or emoji clutter. */
export function speakableText(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[*_#`>]/g, "")
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}
