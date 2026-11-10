import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AssistantApiError,
  assistantErrorMessage,
  audioFileName,
  parseChatResponse,
  parseTranscribeResponse,
  sendChat,
  unwrapApiPayload,
} from "./api";

const hit = {
  id: "p1",
  title: "Depa en Santa Fe",
  type: "DEPARTAMENTO",
  operation: "VENTA",
  price: null,
  currency: "MXN",
  area_m2: 180,
  bedrooms: 3,
  bathrooms: 2,
  parking_spaces: 2,
  neighborhood: "Santa Fe",
  city: "Ciudad de México",
  state: "CDMX",
  latitude: null,
  longitude: null,
  distance_km: 1.2,
  featured_image_url: null,
  url_path: "/propiedades/p1",
};

describe("unwrapApiPayload", () => {
  it("passes a bare payload through", () => {
    expect(unwrapApiPayload({ reply: "hola" })).toEqual({ reply: "hola" });
  });
  it("unwraps a { data } envelope", () => {
    expect(unwrapApiPayload({ data: { reply: "hola" } })).toEqual({ reply: "hola" });
  });
});

describe("parseChatResponse", () => {
  it("accepts bare and wrapped responses", () => {
    const body = { reply: "Encontré 1", properties: [hit], relaxed: true };
    expect(parseChatResponse(body)).toEqual(body);
    expect(parseChatResponse({ data: body })).toEqual(body);
  });
  it("defaults missing fields and drops malformed hits", () => {
    expect(parseChatResponse({ reply: "x" })).toEqual({ reply: "x", properties: [], relaxed: false });
    expect(parseChatResponse({ reply: "x", properties: [{ id: 1 }, hit] }).properties).toEqual([hit]);
  });
  it("rejects a payload without reply", () => {
    expect(() => parseChatResponse({ foo: 1 })).toThrow(AssistantApiError);
    expect(() => parseChatResponse(null)).toThrow(AssistantApiError);
  });
});

describe("parseTranscribeResponse", () => {
  it("returns trimmed text", () => {
    expect(parseTranscribeResponse({ text: "  hola  " })).toBe("hola");
    expect(parseTranscribeResponse({ data: { text: "hola" } })).toBe("hola");
    expect(() => parseTranscribeResponse({})).toThrow(AssistantApiError);
  });
});

describe("sendChat", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("POSTs the messages and parses the reply", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ reply: "ok", properties: [], relaxed: false }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await sendChat([{ role: "user", content: "hola" }]);
    expect(res.reply).toBe("ok");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/api\/v1\/assistant\/chat$/);
    expect(JSON.parse(init.body)).toEqual({ messages: [{ role: "user", content: "hola" }] });
  });

  it("maps HTTP errors to AssistantApiError with the status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));
    await expect(sendChat([{ role: "user", content: "x" }])).rejects.toMatchObject({ status: 429 });
  });

  it("maps network failures to status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(sendChat([{ role: "user", content: "x" }])).rejects.toMatchObject({ status: 0 });
  });
});

describe("assistantErrorMessage", () => {
  it("speaks Spanish for the known statuses", () => {
    expect(assistantErrorMessage(new AssistantApiError(429))).toMatch(/^Vas muy rápido, espera unos segundos/);
    expect(assistantErrorMessage(new AssistantApiError(503))).toMatch(
      /^El asistente no está disponible en este momento/,
    );
    expect(assistantErrorMessage(new AssistantApiError(0))).toMatch(/conexión/);
    expect(assistantErrorMessage(new Error("boom"))).toMatch(/Algo salió mal/);
    expect(assistantErrorMessage(new AssistantApiError(413), "voice")).toMatch(/nota de voz es muy larga/);
  });
});

describe("audioFileName", () => {
  it("picks an extension the API understands", () => {
    expect(audioFileName("audio/webm;codecs=opus")).toBe("nota.webm");
    expect(audioFileName("audio/ogg;codecs=opus")).toBe("nota.ogg");
    expect(audioFileName("audio/mp4")).toBe("nota.m4a");
    expect(audioFileName("audio/mpeg")).toBe("nota.mp3");
    expect(audioFileName("")).toBe("nota.webm");
  });
});
