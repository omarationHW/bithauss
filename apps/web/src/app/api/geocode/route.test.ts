import { describe, it, expect } from "vitest";
import { buildQueryVariants } from "./route";

describe("buildQueryVariants — progressive fallbacks for Nominatim", () => {
  it("includes the original query as the first variant", () => {
    const variants = buildQueryVariants("Polanco, CDMX, México");
    expect(variants[0]).toBe("Polanco, CDMX, México");
  });

  it("strips 'X Sección' subdivisions (Nominatim doesn't index them)", () => {
    const variants = buildQueryVariants(
      "Av. Presidente Masaryk 123, Polanco V Sección, Ciudad de México, México",
    );
    const cleaned = variants.find((v) => !/secci[oó]n/i.test(v));
    expect(cleaned).toBeDefined();
  });

  it("strips CP markers", () => {
    const variants = buildQueryVariants("Roma Norte, CDMX, C.P. 06700, México");
    const noCp = variants.find((v) => !/C\.?\s*P\.?\s*\d+/i.test(v));
    expect(noCp).toBeDefined();
  });

  it("falls back to street + city + country (drops the neighborhood)", () => {
    const variants = buildQueryVariants(
      "Av. Insurgentes 100, Del Valle, Ciudad de México, México",
    );
    const droppedNeighborhood = variants.find(
      (v) =>
        v.includes("Insurgentes 100") &&
        !v.includes("Del Valle") &&
        v.includes("Ciudad de México"),
    );
    expect(droppedNeighborhood).toBeDefined();
  });

  it("falls back to neighborhood (stripping seccion suffix) + city + country", () => {
    const variants = buildQueryVariants(
      "Calle 1, Polanco V Sección, Ciudad de México, México",
    );
    const polancoVariant = variants.find(
      (v) => v.startsWith("Polanco") && !/secci[oó]n/i.test(v),
    );
    expect(polancoVariant).toBeDefined();
  });

  it("returns no duplicate variants", () => {
    const variants = buildQueryVariants("Polanco, Ciudad de México, México");
    expect(new Set(variants).size).toBe(variants.length);
  });

  it("handles a single-part query without crashing", () => {
    const variants = buildQueryVariants("CDMX");
    expect(variants.length).toBeGreaterThanOrEqual(1);
  });
});
