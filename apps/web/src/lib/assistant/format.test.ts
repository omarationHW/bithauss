import { describe, expect, it } from "vitest";
import {
  directionsUrl,
  formatArea,
  formatDistance,
  formatHitLocation,
  formatHitPrice,
  hitImageSrc,
  safePropertyPath,
} from "./format";

describe("formatHitPrice", () => {
  it("formats a sale price with the currency once", () => {
    expect(formatHitPrice({ price: 7_000_000, currency: "MXN", operation: "VENTA" })).toBe("$7,000,000 MXN");
  });
  it("adds /mes for rentals", () => {
    expect(formatHitPrice({ price: 25_000, currency: "MXN", operation: "RENTA" })).toBe("$25,000/mes MXN");
  });
  it("uses the $ symbol for USD too", () => {
    expect(formatHitPrice({ price: 350_000, currency: "usd", operation: "VENTA" })).toBe("$350,000 USD");
  });
  it("says 'Precio a consultar' when the owner hid the price", () => {
    expect(formatHitPrice({ price: null, currency: "MXN", operation: "VENTA" })).toBe("Precio a consultar");
    expect(formatHitPrice({ price: 0, currency: "MXN", operation: "VENTA" })).toBe("Precio a consultar");
  });
  it("defaults to MXN and survives an unknown currency code", () => {
    expect(formatHitPrice({ price: 1000, currency: "", operation: "VENTA" })).toBe("$1,000 MXN");
    expect(formatHitPrice({ price: 1000, currency: "NOPE!", operation: "VENTA" })).toMatch(/1,000 NOPE!$/);
  });
});

describe("formatDistance", () => {
  it("returns null without a distance", () => {
    expect(formatDistance(null)).toBeNull();
    expect(formatDistance(undefined)).toBeNull();
    expect(formatDistance(Number.NaN)).toBeNull();
    expect(formatDistance(-1)).toBeNull();
  });
  it("uses meters under 1 km, rounded to 50 m", () => {
    expect(formatDistance(0.83)).toBe("a 850 m");
    expect(formatDistance(0.01)).toBe("a 50 m");
    expect(formatDistance(0.99)).toBe("a 1 km");
  });
  it("uses one decimal under 10 km and whole km after", () => {
    expect(formatDistance(1.234)).toBe("a 1.2 km");
    expect(formatDistance(3)).toBe("a 3 km");
    expect(formatDistance(12.6)).toBe("a 13 km");
  });
});

describe("directionsUrl", () => {
  it("builds a Google Maps directions link when coordinates exist", () => {
    expect(directionsUrl({ latitude: 19.3592, longitude: -99.2595 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=19.3592,-99.2595",
    );
  });
  it("returns null when the owner hid the address", () => {
    expect(directionsUrl({ latitude: null, longitude: null })).toBeNull();
    expect(directionsUrl({ latitude: 19.3, longitude: null })).toBeNull();
    expect(directionsUrl({ latitude: null, longitude: -99.2 })).toBeNull();
  });
  it("rejects out-of-range coordinates", () => {
    expect(directionsUrl({ latitude: 120, longitude: -99 })).toBeNull();
  });
});

describe("card helpers", () => {
  it("joins colonia and ciudad", () => {
    expect(formatHitLocation({ neighborhood: "Santa Fe", city: "Ciudad de México", state: "CDMX" })).toBe(
      "Santa Fe, Ciudad de México",
    );
    expect(formatHitLocation({ neighborhood: null, city: "Querétaro", state: "Querétaro" })).toBe("Querétaro");
  });
  it("formats area", () => {
    expect(formatArea(180)).toBe("180 m²");
    expect(formatArea(null)).toBeNull();
  });
  it("routes watermarked photos through /api/foto", () => {
    const wm =
      "https://abc.supabase.co/storage/v1/object/public/properties/u1/p1/wm/photo1-ab12-wm.jpg";
    const src = hitImageSrc({ featured_image_url: wm });
    expect(src).toMatch(/^\/api\/foto\?u=/);
    expect(src).toContain("&w=480");
    expect(hitImageSrc({ featured_image_url: null })).toBeNull();
  });
  it("only links to /propiedades/<id>", () => {
    expect(safePropertyPath({ id: "abc", url_path: "/propiedades/abc" })).toBe("/propiedades/abc");
    expect(safePropertyPath({ id: "abc", url_path: "https://evil.example/x" })).toBe("/propiedades/abc");
    expect(safePropertyPath({ id: "abc", url_path: "//evil.example" })).toBe("/propiedades/abc");
  });
});
