/**
 * Knobs of the public property-search assistant (web side). The limits mirror
 * apps/api/src/modules/assistant/assistant.constants.ts — the API rejects
 * anything beyond them, so the client trims before sending.
 */

/** Display name of the bot. Change it here only. */
export const ASSISTANT_NAME = "Asistente BitHauss";

/** Messages per request accepted by the API (DTO). */
export const MAX_REQUEST_MESSAGES = 20;
/** Characters per message accepted by the API (DTO). */
export const MAX_MESSAGE_CHARS = 500;

/** Voice notes: the API rejects more than 1 MB. Stop a bit before. */
export const MAX_RECORDING_MS = 60_000;
export const MAX_RECORDING_BYTES = 950 * 1024;
/** Anything shorter is almost certainly an accidental tap. */
export const MIN_RECORDING_MS = 600;
/** Low bitrate keeps 60 s of opus/aac at ~250 KB. */
export const RECORDING_BITS_PER_SECOND = 32_000;

export const SPEECH_LANG = "es-MX";

/** sessionStorage: the conversation lives only while the tab is open. */
export const CONVERSATION_STORAGE_KEY = "bithauss.assistant.conversation.v1";
/** localStorage: whether the user wants spoken replies. */
export const SPEAK_REPLIES_STORAGE_KEY = "bithauss.assistant.speak.v1";

export const ASSISTANT_GREETING =
  "¡Hola! Cuéntame qué buscas y te muestro opciones. Puedes escribir o mandarme una nota de voz.";

export const EXAMPLE_PROMPTS = [
  "Departamento de 3 recámaras cerca de Santa Fe",
  "Casa en renta en Guadalajara por menos de $25,000",
  "Terreno de 500 m² en Querétaro",
] as const;

/**
 * Public pages where the widget shows. An allowlist on purpose: a new private
 * section (/dashboard, /admin, /auth, …) stays bot-free without anyone having
 * to remember to exclude it.
 */
export const ASSISTANT_ROUTE_PREFIXES = [
  "/propiedades",
  "/como-funciona",
  "/nosotros",
  "/certificado",
] as const;

export function isAssistantRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname === "/") return true;
  return ASSISTANT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
