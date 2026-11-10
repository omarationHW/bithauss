import { describe, expect, it } from "vitest";
import {
  detectVoiceCapabilities,
  isPermissionError,
  isSpeechServiceFailure,
  pickRecorderMimeType,
  pickSpanishVoice,
  readRecognitionResults,
  selectVoicePath,
  speakableText,
} from "./speech";

const all = { speechRecognition: true, mediaRecorder: true, getUserMedia: true };

describe("selectVoicePath", () => {
  it("prefers the free browser recognizer", () => {
    expect(selectVoicePath(all)).toBe("speech");
  });
  it("falls back to recording + transcribe", () => {
    expect(selectVoicePath({ ...all, speechRecognition: false })).toBe("recorder");
    expect(selectVoicePath(all, { speechFailed: true })).toBe("recorder");
  });
  it("hides the mic when nothing works", () => {
    expect(selectVoicePath({ speechRecognition: false, mediaRecorder: true, getUserMedia: false })).toBe("none");
    expect(selectVoicePath({ speechRecognition: false, mediaRecorder: false, getUserMedia: true })).toBe("none");
    expect(selectVoicePath({ ...all, mediaRecorder: false }, { speechFailed: true })).toBe("none");
  });
});

describe("detectVoiceCapabilities", () => {
  const Ctor = function () {} as unknown;
  it("finds webkitSpeechRecognition and MediaRecorder", () => {
    expect(
      detectVoiceCapabilities({
        webkitSpeechRecognition: Ctor,
        MediaRecorder: Ctor,
        navigator: { mediaDevices: { getUserMedia: () => null } },
      }),
    ).toEqual(all);
  });
  it("reports nothing outside a secure context", () => {
    expect(
      detectVoiceCapabilities({
        isSecureContext: false,
        SpeechRecognition: Ctor,
        MediaRecorder: Ctor,
        navigator: { mediaDevices: { getUserMedia: () => null } },
      }),
    ).toEqual({ speechRecognition: false, mediaRecorder: false, getUserMedia: false });
  });
  it("reports nothing on a bare window", () => {
    expect(detectVoiceCapabilities({})).toEqual({
      speechRecognition: false,
      mediaRecorder: false,
      getUserMedia: false,
    });
  });
});

describe("speech errors", () => {
  it("falls back only on service-level failures", () => {
    expect(isSpeechServiceFailure("network")).toBe(true);
    expect(isSpeechServiceFailure("service-not-allowed")).toBe(true);
    expect(isSpeechServiceFailure("not-allowed")).toBe(false);
    expect(isSpeechServiceFailure("no-speech")).toBe(false);
  });
  it("recognizes permission denial from both APIs", () => {
    expect(isPermissionError("not-allowed")).toBe(true);
    expect(isPermissionError(new DOMException("denied", "NotAllowedError"))).toBe(true);
    expect(isPermissionError(new DOMException("none", "NotFoundError"))).toBe(false);
  });
});

describe("pickRecorderMimeType", () => {
  it("returns the first supported candidate", () => {
    expect(pickRecorderMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
    expect(pickRecorderMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });
  it("lets the browser choose when it can't be asked, null when nothing fits", () => {
    expect(pickRecorderMimeType(undefined)).toBe("");
    expect(pickRecorderMimeType(() => false)).toBeNull();
  });
});

describe("readRecognitionResults", () => {
  it("splits final and interim text", () => {
    const event = {
      resultIndex: 0,
      results: {
        length: 2,
        0: { isFinal: true, length: 1, 0: { transcript: "búscame un departamento " } },
        1: { isFinal: false, length: 1, 0: { transcript: "en Santa" } },
      },
    };
    expect(readRecognitionResults(event)).toEqual({ final: "búscame un departamento", interim: "en Santa" });
  });
});

describe("pickSpanishVoice", () => {
  const v = (lang: string, name = lang, localService = false) => ({ lang, name, localService });
  it("prefers es-MX, then Latin American Spanish, then any Spanish", () => {
    expect(pickSpanishVoice([v("en-US"), v("es-ES"), v("es-MX")])?.lang).toBe("es-MX");
    expect(pickSpanishVoice([v("es-ES"), v("es-US")])?.lang).toBe("es-US");
    expect(pickSpanishVoice([v("en-US"), v("es_ES")])?.lang).toBe("es_ES");
    expect(pickSpanishVoice([v("en-US")])).toBeNull();
  });
  it("prefers a local voice among equals", () => {
    expect(pickSpanishVoice([v("es-MX", "remote"), v("es-MX", "local", true)])?.name).toBe("local");
  });
});

describe("speakableText", () => {
  it("strips links, markdown and emoji", () => {
    expect(speakableText("**Encontré** 2 opciones 🏠 https://x.y/z")).toBe("Encontré 2 opciones");
  });
});
