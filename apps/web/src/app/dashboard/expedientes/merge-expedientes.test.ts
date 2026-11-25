import { describe, expect, it } from "vitest";
import { mergeExpedientes } from "./merge-expedientes";
import { generatedWatermarkFolder } from "@/lib/watermark";

describe("mergeExpedientes", () => {
  it("no repite y ordena del más reciente al más antiguo", () => {
    const a = { id: "a", created_at: "2026-01-01" };
    const b = { id: "b", created_at: "2026-02-01" };
    expect(mergeExpedientes([[a], [b, a]]).map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("generatedWatermarkFolder", () => {
  it("reconoce el sello de cualquier persona del equipo, solo de ese inmueble", () => {
    expect(generatedWatermarkFolder("owner/p1/wm/k-abc-wm.jpg", "p1")).toBe("owner");
    expect(generatedWatermarkFolder("owner/p2/wm/k-abc-wm.jpg", "p1")).toBeNull();
    expect(generatedWatermarkFolder("owner/p1/000.jpg", "p1")).toBeNull();
  });
});
