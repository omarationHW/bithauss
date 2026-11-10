import type { AssistantChatMessage, PropertySearchHit } from "@bithauss/types";
import { MAX_MESSAGE_CHARS, MAX_REQUEST_MESSAGES } from "./constants";

/** One bubble in the panel. Only role + content ever reach the API. */
export interface ConversationMessage {
  id: string;
  role: AssistantChatMessage["role"];
  content: string;
  /** Cards rendered under an assistant reply. */
  properties?: PropertySearchHit[];
  relaxed?: boolean;
}

/** Truncate to the API's per-message limit without splitting a surrogate pair. */
export function truncateMessage(text: string, max = MAX_MESSAGE_CHARS): string {
  if (text.length <= max) return text;
  let cut = text.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) cut = cut.slice(0, -1);
  return cut;
}

/**
 * The request body the stateless API needs: the tail of the conversation
 * (≤ 20 messages, ≤ 500 chars each, no blanks), always ending on the user's
 * turn — the API rejects anything else.
 */
export function toRequestMessages(
  conversation: readonly Pick<ConversationMessage, "role" | "content">[],
  maxMessages = MAX_REQUEST_MESSAGES,
): AssistantChatMessage[] {
  const cleaned = conversation
    .map((m) => ({ role: m.role, content: truncateMessage(m.content.trim()) }))
    .filter((m) => m.content.length > 0 && (m.role === "user" || m.role === "assistant"));

  // Drop trailing assistant turns: the last message must be the user's.
  let end = cleaned.length;
  while (end > 0 && cleaned[end - 1]!.role !== "user") end--;

  return cleaned.slice(Math.max(0, end - maxMessages), end);
}

function isHit(value: unknown): value is PropertySearchHit {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string" && typeof v.url_path === "string";
}

function isStoredMessage(value: unknown): value is ConversationMessage {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    (v.role === "user" || v.role === "assistant") &&
    typeof v.content === "string" &&
    (v.properties === undefined || (Array.isArray(v.properties) && v.properties.every(isHit)))
  );
}

/** Messages kept in sessionStorage — plenty for a session, bounded for quota. */
const MAX_STORED_MESSAGES = 60;

export function parseStoredConversation(raw: string | null): ConversationMessage[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isStoredMessage).slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export function serializeConversation(conversation: readonly ConversationMessage[]): string {
  return JSON.stringify(conversation.slice(-MAX_STORED_MESSAGES));
}

/** sessionStorage can be missing or throw (private mode, blocked storage). */
export function loadConversation(storage: Storage | undefined, key: string): ConversationMessage[] {
  try {
    return parseStoredConversation(storage?.getItem(key) ?? null);
  } catch {
    return [];
  }
}

export function saveConversation(
  storage: Storage | undefined,
  key: string,
  conversation: readonly ConversationMessage[],
): void {
  try {
    if (!storage) return;
    if (conversation.length === 0) storage.removeItem(key);
    else storage.setItem(key, serializeConversation(conversation));
  } catch {
    /* quota or blocked storage: the chat still works, it just won't survive a reload */
  }
}

let counter = 0;
export function newMessageId(): string {
  counter += 1;
  return `${Date.now().toString(36)}-${counter.toString(36)}`;
}
