import type {
  AssistantChatMessage,
  AssistantChatResponse,
  PropertySearchHit,
} from "@bithauss/types";

/**
 * Calls to the public assistant API.
 *
 * Uses the same base as the rest of the web's direct API calls
 * (`${NEXT_PUBLIC_API_URL}/api/v1/...`; empty → same-origin via the
 * /api/v1 rewrite). `lib/api-client.ts` is not used: it neither forwards an
 * AbortSignal (needed to cancel on close) nor sends multipart bodies.
 *
 * The Nest API does not wrap responses in `{ data }` (there is no transform
 * interceptor), but unwrapApiPayload tolerates it so a future envelope does
 * not silently break the widget.
 */
function apiUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/v1${path}`;
}

export class AssistantApiError extends Error {
  constructor(
    /** HTTP status, or 0 for network failures / invalid payloads. */
    public readonly status: number,
    message?: string,
  ) {
    super(message ?? `Assistant API error ${status}`);
    this.name = "AssistantApiError";
  }
}

/** Accepts `{ ...payload }` or `{ data: { ...payload } }`. */
export function unwrapApiPayload(json: unknown): unknown {
  if (
    json &&
    typeof json === "object" &&
    "data" in json &&
    !("reply" in json) &&
    !("text" in json)
  ) {
    return (json as { data: unknown }).data;
  }
  return json;
}

function isHit(value: unknown): value is PropertySearchHit {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.title === "string" &&
    typeof v.url_path === "string" &&
    (v.price === null || typeof v.price === "number")
  );
}

export function parseChatResponse(json: unknown): AssistantChatResponse {
  const payload = unwrapApiPayload(json);
  if (!payload || typeof payload !== "object") throw new AssistantApiError(0, "Respuesta inválida");
  const p = payload as Record<string, unknown>;
  if (typeof p.reply !== "string") throw new AssistantApiError(0, "Respuesta inválida");
  return {
    reply: p.reply,
    properties: Array.isArray(p.properties) ? p.properties.filter(isHit) : [],
    relaxed: p.relaxed === true,
  };
}

export function parseTranscribeResponse(json: unknown): string {
  const payload = unwrapApiPayload(json);
  const text = payload && typeof payload === "object" ? (payload as { text?: unknown }).text : undefined;
  if (typeof text !== "string") throw new AssistantApiError(0, "Respuesta inválida");
  return text.trim();
}

async function postJson(path: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), init);
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new AssistantApiError(0, "Sin conexión");
  }
  if (!response.ok) throw new AssistantApiError(response.status);
  try {
    return await response.json();
  } catch {
    throw new AssistantApiError(0, "Respuesta inválida");
  }
}

export async function sendChat(
  messages: AssistantChatMessage[],
  signal?: AbortSignal,
): Promise<AssistantChatResponse> {
  const json = await postJson("/assistant/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages }),
    signal,
  });
  return parseChatResponse(json);
}

/** File extension the API/Azure expects for a recorder mime type. */
export function audioFileName(mimeType: string): string {
  const base = mimeType.split(";")[0]!.trim().toLowerCase();
  if (base.includes("webm")) return "nota.webm";
  if (base.includes("ogg")) return "nota.ogg";
  if (base.includes("mp4") || base.includes("m4a") || base.includes("aac")) return "nota.m4a";
  if (base.includes("mpeg") || base.includes("mp3")) return "nota.mp3";
  if (base.includes("wav")) return "nota.wav";
  return "nota.webm";
}

export async function transcribeAudio(audio: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append("audio", audio, audioFileName(audio.type));
  const json = await postJson("/assistant/transcribe", { method: "POST", body: form, signal });
  return parseTranscribeResponse(json);
}

/** Friendly Spanish copy for every failure the panel can show. */
export function assistantErrorMessage(error: unknown, kind: "chat" | "voice" = "chat"): string {
  const status = error instanceof AssistantApiError ? error.status : -1;
  switch (status) {
    case 429:
      return "Vas muy rápido, espera unos segundos e inténtalo de nuevo.";
    case 503:
      return "El asistente no está disponible en este momento. Inténtalo más tarde.";
    case 413:
      return "La nota de voz es muy larga. Intenta con un mensaje más corto.";
    case 400:
    case 422:
      return kind === "voice"
        ? "No pude procesar la nota de voz. Intenta grabarla otra vez o escríbeme."
        : "No pude procesar ese mensaje. Intenta escribirlo de otra forma.";
    case 0:
      return "No pude conectarme. Revisa tu conexión e inténtalo de nuevo.";
    default:
      return kind === "voice"
        ? "No pude entender la nota de voz. Intenta otra vez o escríbeme."
        : "Algo salió mal. Inténtalo de nuevo en un momento.";
  }
}
