import { describe, expect, it } from "vitest";

import { hasBakedWatermark, originalPhotoUrl } from "./clean-photo";

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
