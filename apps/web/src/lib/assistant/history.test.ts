import { describe, expect, it } from "vitest";
import {
  loadConversation,
  parseStoredConversation,
  saveConversation,
  toRequestMessages,
  truncateMessage,
  type ConversationMessage,
} from "./history";

const msg = (role: "user" | "assistant", content: string): ConversationMessage => ({
  id: Math.random().toString(36),
  role,
  content,
});

describe("toRequestMessages", () => {
  it("sends only role and content", () => {
    const out = toRequestMessages([
      { ...msg("user", "hola"), id: "1" },
      { ...msg("assistant", "¿qué buscas?"), properties: [] } as ConversationMessage,
      msg("user", "depa en Santa Fe"),
    ]);
    expect(out).toEqual([
      { role: "user", content: "hola" },
      { role: "assistant", content: "¿qué buscas?" },
      { role: "user", content: "depa en Santa Fe" },
    ]);
  });

  it("keeps at most the last 20 messages", () => {
    const conv: ConversationMessage[] = [];
    for (let i = 0; i < 30; i++) conv.push(msg(i % 2 === 0 ? "user" : "assistant", `m${i}`));
    conv.push(msg("user", "último"));
    const out = toRequestMessages(conv);
    expect(out).toHaveLength(20);
    expect(out.at(-1)).toEqual({ role: "user", content: "último" });
    expect(out[0]!.content).toBe("m11");
  });

  it("truncates every message to 500 chars (bot replies included)", () => {
    const out = toRequestMessages([msg("user", "a"), msg("assistant", "b".repeat(900)), msg("user", "c".repeat(600))]);
    expect(out[1]!.content).toHaveLength(500);
    expect(out[2]!.content).toHaveLength(500);
  });

  it("always ends on a user message and drops blanks", () => {
    const out = toRequestMessages([msg("user", "hola"), msg("assistant", "   "), msg("assistant", "respuesta")]);
    expect(out).toEqual([{ role: "user", content: "hola" }]);
    expect(toRequestMessages([msg("assistant", "solo bot")])).toEqual([]);
  });
});

describe("truncateMessage", () => {
  it("does not split a surrogate pair", () => {
    const text = "a".repeat(499) + "😀";
    const cut = truncateMessage(text);
    expect(cut).toBe("a".repeat(499));
  });
});

describe("conversation storage", () => {
  it("round-trips through sessionStorage", () => {
    const conv = [msg("user", "hola"), { ...msg("assistant", "hey"), properties: [], relaxed: true }];
    saveConversation(window.sessionStorage, "k", conv);
    expect(loadConversation(window.sessionStorage, "k")).toEqual(conv);
    saveConversation(window.sessionStorage, "k", []);
    expect(window.sessionStorage.getItem("k")).toBeNull();
  });

  it("ignores corrupt or foreign data", () => {
    expect(parseStoredConversation("{not json")).toEqual([]);
    expect(parseStoredConversation('{"a":1}')).toEqual([]);
    expect(parseStoredConversation('[{"id":"1","role":"system","content":"x"},{"id":"2","role":"user","content":"ok"}]')).toEqual([
      { id: "2", role: "user", content: "ok" },
    ]);
  });

  it("never throws when storage is blocked", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceeded");
      },
      removeItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Storage;
    expect(loadConversation(throwing, "k")).toEqual([]);
    expect(() => saveConversation(throwing, "k", [msg("user", "x")])).not.toThrow();
    expect(loadConversation(undefined, "k")).toEqual([]);
  });
});
