import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanPhotoSrc,
  hasBakedWatermark,
  originalPhotoUrl,
  resolveCleanPhotoUrls,
} from "./clean-photo";

const SUPA = "https://abc.supabase.co/storage/v1/object/public/properties";

describe("originalPhotoUrl", () => {
  it("deriva el original archivado de una foto estampada por BitHauss", () => {
    expect(
      originalPhotoUrl(`${SUPA}/u1/p1/wm/1f2e-3d4c-0abc123-wm.jpg?v=0abc123`),
    ).toBe(`${SUPA}/u1/p1/originals/1f2e-3d4c.orig`);
  });

  it("devuelve null para fotos sin marca o del esquema legado sin original", () => {
    expect(originalPhotoUrl(`${SUPA}/u1/p1/abc.jpg`)).toBeNull();
    // Antes de a82d513 se subía `<n>-wm.<ext>` sin guardar el original.
    expect(originalPhotoUrl(`${SUPA}/u1/p1/0-wm.jpg`)).toBeNull();
    expect(originalPhotoUrl("https://cdn.example.com/x/wm/a-0abc123-wm.jpg")).toBeNull();
    expect(originalPhotoUrl(null)).toBeNull();
  });

  it("detecta la marca horneada por el sufijo -wm", () => {
    expect(hasBakedWatermark(`${SUPA}/u1/p1/0-wm.jpg`)).toBe(true);
    expect(hasBakedWatermark(`${SUPA}/u1/p1/wm/a-0abc123-wm.jpg?v=1`)).toBe(true);
    expect(hasBakedWatermark(`${SUPA}/u1/p1/a.jpg`)).toBe(false);
  });
});

describe("resolveCleanPhotoUrls", () => {
  const WM =
    "https://x.supabase.co/storage/v1/object/public/properties/u1/p1/wm/k1-abc12-wm.jpg?v=abc12";
  const ORIG = "https://x.supabase.co/storage/v1/object/public/properties/u1/p1/originals/k1.orig";

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubHead(impl: () => Promise<Response>) {
    const fetchMock = vi.fn(impl);
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("usa el original cuando existe, con un HEAD (sin descargar la imagen)", async () => {
    const fetchMock = stubHead(async () =>
      new Response(null, { status: 200, headers: { "content-type": "image/png" } }),
    );
    const map = await resolveCleanPhotoUrls([WM]);
    expect(map.get(WM)).toBe(ORIG);
    expect(fetchMock).toHaveBeenCalledWith(ORIG, expect.objectContaining({ method: "HEAD" }));
  });

  it("cae a la foto publicada solo si consta que el original no existe", async () => {
    stubHead(async () => new Response(null, { status: 404 }));
    expect((await resolveCleanPhotoUrls([WM])).get(WM)).toBe(WM);
  });

  it("un original que no es imagen no sirve", async () => {
    stubHead(async () =>
      new Response(null, { status: 200, headers: { "content-type": "application/octet-stream" } }),
    );
    expect((await resolveCleanPhotoUrls([WM])).get(WM)).toBe(WM);
  });

  it("si la red falla o tarda, se queda con el original (nunca el logo)", async () => {
    stubHead(async () => {
      throw new TypeError("network");
    });
    expect((await resolveCleanPhotoUrls([WM])).get(WM)).toBe(ORIG);
  });

  it("deja igual una foto sin marca", async () => {
    stubHead(async () => new Response(null, { status: 200 }));
    const plain = "https://x.supabase.co/storage/v1/object/public/properties/u1/p1/foto.jpg";
    expect((await resolveCleanPhotoUrls([plain])).get(plain)).toBe(plain);
  });
});

describe("cleanPhotoSrc", () => {
  const WM = `${SUPA}/u1/p1/wm/k1-abc12-wm.jpg?v=abc12`;

  it("manda las fotos estampadas por /api/foto con el ancho pedido", () => {
    expect(cleanPhotoSrc(WM, 480)).toBe(`/api/foto?u=${encodeURIComponent(WM)}&w=480`);
  });

  it("usa 960 por defecto", () => {
    expect(cleanPhotoSrc(WM)).toContain("&w=960");
  });

  it("deja igual las fotos sin marca y los vacíos", () => {
    const plain = `${SUPA}/u1/p1/foto.jpg`;
    expect(cleanPhotoSrc(plain)).toBe(plain);
    expect(cleanPhotoSrc(null)).toBeNull();
  });
});
