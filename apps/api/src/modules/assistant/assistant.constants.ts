/**
 * Every cost knob of the public assistant lives here so it can be tuned in one
 * place. The assistant is anonymous and public: each request is paid by us,
 * so the limits are deliberately tight.
 */

/** Messages the client may send in one request (DTO rejects more). */
export const MAX_REQUEST_MESSAGES = 20;
/** Characters per message (DTO rejects longer). */
export const MAX_MESSAGE_CHARS = 500;
/** Only the tail of the conversation reaches the model. */
export const MAX_HISTORY_MESSAGES = 8;

/** Tool rounds per request; after that the model must answer. */
export const MAX_TOOL_ROUNDS = 2;
/** Tool calls honoured inside one round (a model fanning out 6 searches is a cost bug). */
export const MAX_TOOL_CALLS_PER_ROUND = 2;

export const LLM_MAX_TOKENS = 350;
export const LLM_TEMPERATURE = 0.3;
export const LLM_TIMEOUT_MS = 20_000;
/** Same api-version the OCR module uses against the same resource. */
export const CHAT_API_VERSION = '2025-01-01-preview';

/** Nominatim */
export const GEOCODE_TIMEOUT_MS = 3_000;
export const GEOCODE_TTL_MS = 24 * 60 * 60 * 1000;
export const GEOCODE_CACHE_MAX = 500;
/** Same identity the web geocode proxy sends (Nominatim fair-use policy). */
export const NOMINATIM_USER_AGENT = 'BitHauss/1.0 (real-estate; contact@bithauss.com)';

export const DEFAULT_RADIUS_KM = 3;
export const MAX_RADIUS_KM = 50;
export const DEFAULT_RESULT_LIMIT = 5;

/** Voice notes: ~60 s of opus/aac fits comfortably in 1 MB. */
export const MAX_AUDIO_BYTES = 1024 * 1024;
export const TRANSCRIBE_TIMEOUT_MS = 20_000;
/** gpt-4o(-mini)-transcribe needs 2025-03-01-preview or later; whisper works too. */
export const DEFAULT_TRANSCRIBE_API_VERSION = '2025-03-01-preview';
