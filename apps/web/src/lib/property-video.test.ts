import { describe, it, expect } from "vitest";

import {
  MAX_PROPERTY_VIDEOS,
  MAX_VIDEO_FILE_BYTES,
  canAddVideos,
  embedUrlFor,
  fileExtension,
  formatBytes,
  isEmbeddableVideoUrl,
  isVideoMedia,
  parseVideoUrl,
  sniffVideoMime,
  splitPropertyMedia,
  validateVideoFile,
} from "./property-video";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** ISO base media header: 4 size bytes + "ftyp" + brand. */
function isoHeader(brand: string): Uint8Array {
  const bytes = new Uint8Array(16);
  bytes.set([0x00, 0x00, 0x00, 0x20], 0);
  const marker = "ftyp" + brand;
  for (let i = 0; i < marker.length; i++) {
    bytes[4 + i] = marker.charCodeAt(i);
  }
  return bytes;
}

const MP4_HEAD = isoHeader("isom");
const MOV_HEAD = isoHeader("qt  ");
const WEBM_HEAD = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x1f,
]);
/** "<!DOCTYPE html>" — a page renamed to .mp4. */
const HTML_HEAD = new Uint8Array(
  Array.from("<!DOCTYPE html>", (c) => c.charCodeAt(0)),
);

/* ------------------------------------------------------------------ */
/*  YouTube                                                            */
/* ------------------------------------------------------------------ */

describe("parseVideoUrl · YouTube", () => {
  const ID = "dQw4w9WgXcQ";

  it.each([
    `https://youtu.be/${ID}`,
    `https://www.youtu.be/${ID}`,
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://music.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://www.youtube.com/live/${ID}`,
    `https://www.youtube.com/v/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}`,
    `http://www.youtube.com/watch?v=${ID}`,
    `youtu.be/${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `  https://youtu.be/${ID}  `,
  ])("reconoce %s", (url) => {
    const parsed = parseVideoUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed!.provider).toBe("YOUTUBE");
    expect(parsed!.externalId).toBe(ID);
  });

  it("normaliza siempre a la URL canónica, sin parámetros de rastreo", () => {
    const parsed = parseVideoUrl(
      `https://www.youtube.com/watch?v=${ID}&list=PL666&si=track&t=90`,
    );
    // The stored URL is REBUILT from the id: playlist/session params the user
    // pasted never reach the database or the iframe.
    expect(parsed!.canonicalUrl).toBe(`https://www.youtube.com/watch?v=${ID}`);
    expect(parsed!.embedUrl).toContain("youtube-nocookie.com/embed/" + ID);
    expect(parsed!.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  });

  it("rechaza ids con longitud incorrecta", () => {
    expect(parseVideoUrl("https://youtu.be/short")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch?v=waytoolongid123")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/watch")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/")).toBeNull();
    expect(parseVideoUrl("https://www.youtube.com/results?search_query=casa")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Vimeo                                                              */
/* ------------------------------------------------------------------ */

describe("parseVideoUrl · Vimeo", () => {
  it.each([
    "https://vimeo.com/123456789",
    "https://www.vimeo.com/123456789",
    "https://player.vimeo.com/video/123456789",
    "https://vimeo.com/channels/staffpicks/123456789",
    "vimeo.com/123456789",
  ])("reconoce %s", (url) => {
    const parsed = parseVideoUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed!.provider).toBe("VIMEO");
    expect(parsed!.externalId).toBe("123456789");
    expect(parsed!.canonicalUrl).toBe("https://vimeo.com/123456789");
    expect(parsed!.embedUrl).toContain("player.vimeo.com/video/123456789");
  });

  it("conserva el hash de un video no listado", () => {
    const parsed = parseVideoUrl("https://vimeo.com/123456789/a1b2c3d4e5");
    expect(parsed!.externalId).toBe("123456789:a1b2c3d4e5");
    expect(parsed!.canonicalUrl).toBe("https://vimeo.com/123456789/a1b2c3d4e5");
    expect(parsed!.embedUrl).toContain("h=a1b2c3d4e5");

    const fromPlayer = parseVideoUrl(
      "https://player.vimeo.com/video/123456789?h=a1b2c3d4e5",
    );
    expect(fromPlayer!.externalId).toBe("123456789:a1b2c3d4e5");
  });

  it("no tiene miniatura sin llamar a la API de Vimeo", () => {
    expect(parseVideoUrl("https://vimeo.com/123456789")!.thumbnailUrl).toBeNull();
  });

  it("rechaza rutas de Vimeo sin id numérico", () => {
    expect(parseVideoUrl("https://vimeo.com/bithauss")).toBeNull();
    expect(parseVideoUrl("https://player.vimeo.com/otra/123456789")).toBeNull();
    expect(parseVideoUrl("https://vimeo.com/12")).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Seguridad: URLs maliciosas                                         */
/* ------------------------------------------------------------------ */

describe("parseVideoUrl · URLs maliciosas", () => {
  const MALICIOUS: [string, string][] = [
    ["javascript:alert(1)", "esquema javascript"],
    ["JavaScript:alert(document.cookie)", "esquema javascript en mayúsculas"],
    ["java\tscript:alert(1)", "esquema ofuscado con tabulador"],
    ["data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", "data: URI"],
    ["vbscript:msgbox(1)", "esquema vbscript"],
    ["file:///etc/passwd", "esquema file"],
    ["https://youtube.com.evil.tld/watch?v=dQw4w9WgXcQ", "host parecido con sufijo"],
    ["https://evilyoutube.com/watch?v=dQw4w9WgXcQ", "host parecido con prefijo"],
    ["https://evil.tld/youtube.com/watch?v=dQw4w9WgXcQ", "host falso en la ruta"],
    ["https://vimeo.com.attacker.io/123456789", "host de vimeo suplantado"],
    ["https://user:pass@www.youtube.com/watch?v=dQw4w9WgXcQ", "URL con credenciales"],
    ["https://attacker.io@www.youtube.com/watch?v=dQw4w9WgXcQ", "usuario incrustado"],
    ["//www.youtube.com/watch?v=dQw4w9WgXcQ", "URL relativa al protocolo"],
    ["http://169.254.169.254/latest/meta-data/", "metadata interno (SSRF)"],
    ["http://localhost:3000/admin", "host local"],
    ["https://youtube.com@evil.tld/watch?v=dQw4w9WgXcQ", "arroba engañoso"],
    ["", "cadena vacía"],
    ["   ", "solo espacios"],
    ["no es una url", "texto libre"],
  ];

  it.each(MALICIOUS)("rechaza %s (%s)", (url) => {
    expect(parseVideoUrl(url)).toBeNull();
    expect(isEmbeddableVideoUrl(url)).toBe(false);
  });

  it("embedUrlFor nunca devuelve una URL que no sea de un proveedor permitido", () => {
    // Even a row written straight into Postgres is re-parsed before it can
    // reach an <iframe src>.
    expect(embedUrlFor("YOUTUBE", "javascript:alert(1)")).toBeNull();
    expect(embedUrlFor("YOUTUBE", "https://evil.tld/embed/abc")).toBeNull();
    expect(embedUrlFor("UPLOAD", "https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(embedUrlFor("YOUTUBE", "https://youtu.be/dQw4w9WgXcQ")).toContain(
      "youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Magic bytes                                                        */
/* ------------------------------------------------------------------ */

describe("sniffVideoMime", () => {
  it("detecta MP4, MOV y WebM por sus bytes", () => {
    expect(sniffVideoMime(MP4_HEAD)).toBe("video/mp4");
    expect(sniffVideoMime(MOV_HEAD)).toBe("video/quicktime");
    expect(sniffVideoMime(WEBM_HEAD)).toBe("video/webm");
  });

  it("no detecta contenido que no es video", () => {
    expect(sniffVideoMime(HTML_HEAD)).toBeNull();
    expect(sniffVideoMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBeNull();
    expect(sniffVideoMime(new Uint8Array())).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  Validación de archivo                                              */
/* ------------------------------------------------------------------ */

describe("validateVideoFile", () => {
  it("acepta un MP4 dentro del límite", () => {
    const result = validateVideoFile(
      { name: "recorrido.mp4", size: 12 * 1024 * 1024 },
      { head: MP4_HEAD },
    );
    expect(result.ok).toBe(true);
    expect(result.detectedMime).toBe("video/mp4");
  });

  it("acepta WebM y MOV", () => {
    expect(validateVideoFile({ name: "a.webm", size: 100 }, { head: WEBM_HEAD }).ok).toBe(true);
    expect(validateVideoFile({ name: "a.mov", size: 100 }, { head: MOV_HEAD }).ok).toBe(true);
  });

  it("rechaza por formato y lo explica", () => {
    const result = validateVideoFile({ name: "plano.pdf", size: 1000 });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BAD_EXTENSION");
    expect(result.message).toMatch(/MP4, WebM o MOV/);
    expect(result.message).toMatch(/\.pdf/);
  });

  it("rechaza por tamaño y dice cuánto pesa", () => {
    const result = validateVideoFile({
      name: "grande.mp4",
      size: MAX_VIDEO_FILE_BYTES + 1,
    });
    expect(result.ok).toBe(false);
    expect(result.code).toBe("TOO_LARGE");
    expect(result.message).toContain("200 MB");
  });

  it("rechaza un archivo cuyo contenido no es video aunque la extensión mienta", () => {
    // The classic bypass: rename an HTML page to .mp4 so it is served from our
    // own (public) storage origin.
    const result = validateVideoFile(
      { name: "tour.mp4", size: 500, type: "video/mp4" },
      { head: HTML_HEAD },
    );
    expect(result.ok).toBe(false);
    expect(result.code).toBe("BAD_CONTENT");
  });

  it("rechaza archivos vacíos", () => {
    expect(validateVideoFile({ name: "a.mp4", size: 0 }).code).toBe("EMPTY");
  });

  it("respeta un límite de tamaño configurado", () => {
    expect(
      validateVideoFile({ name: "a.mp4", size: 2000 }, { maxBytes: 1000 }).code,
    ).toBe("TOO_LARGE");
  });
});

/* ------------------------------------------------------------------ */
/*  Límite por propiedad                                               */
/* ------------------------------------------------------------------ */

describe("canAddVideos", () => {
  it("permite hasta el máximo", () => {
    expect(canAddVideos(0).ok).toBe(true);
    expect(canAddVideos(MAX_PROPERTY_VIDEOS - 1).ok).toBe(true);
  });

  it("bloquea al alcanzar el máximo", () => {
    const result = canAddVideos(MAX_PROPERTY_VIDEOS);
    expect(result.ok).toBe(false);
    expect(result.code).toBe("LIMIT_REACHED");
    expect(result.message).toContain(String(MAX_PROPERTY_VIDEOS));
  });

  it("considera cuántos se agregan de golpe", () => {
    expect(canAddVideos(1, 3).ok).toBe(false);
    expect(canAddVideos(1, 2).ok).toBe(true);
  });
});

/* ------------------------------------------------------------------ */
/*  Utilidades                                                         */
/* ------------------------------------------------------------------ */

describe("helpers", () => {
  it("fileExtension", () => {
    expect(fileExtension("Video FINAL.MP4")).toBe("mp4");
    expect(fileExtension("sinextension")).toBe("");
    expect(fileExtension("termina.")).toBe("");
  });

  it("formatBytes", () => {
    expect(formatBytes(MAX_VIDEO_FILE_BYTES)).toBe("200 MB");
    expect(formatBytes(2048)).toBe("2 KB");
  });

  it("splitPropertyMedia separa video de imágenes", () => {
    const rows = [
      { url: "a.jpg", media_type: "IMAGE" },
      { url: "b.mp4", media_type: "VIDEO" },
      { url: "c.jpg" }, // legacy row without media_type
    ];
    const { images, videos } = splitPropertyMedia(rows);
    expect(images.map((r) => r.url)).toEqual(["a.jpg", "c.jpg"]);
    expect(videos.map((r) => r.url)).toEqual(["b.mp4"]);
    expect(isVideoMedia({ url: "b.mp4", media_type: "video" })).toBe(true);
  });
});
