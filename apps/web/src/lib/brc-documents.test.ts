import { describe, it, expect } from "vitest";
import {
  isDocumentRequired,
  requiresUsoDeSuelo,
  USO_DE_SUELO_DOC,
} from "./brc-documents";

const usoDeSuelo = { name: USO_DE_SUELO_DOC, is_required: false };
const escritura = {
  name: "Escritura de Propiedad del Inmueble a Certificar",
  is_required: true,
};

describe("requiresUsoDeSuelo", () => {
  it("applies to the sale of a house zoned for commercial use", () => {
    expect(requiresUsoDeSuelo({ type: "CASA_USO_SUELO", operation: "VENTA" })).toBe(true);
  });

  it("applies to the sale of an office", () => {
    expect(requiresUsoDeSuelo({ type: "OFICINA", operation: "VENTA" })).toBe(true);
  });

  it("applies when the listing is both for sale and for rent", () => {
    expect(requiresUsoDeSuelo({ type: "OFICINA", operation: "VENTA_RENTA" })).toBe(true);
  });

  it("does not apply to a rental", () => {
    expect(requiresUsoDeSuelo({ type: "OFICINA", operation: "RENTA" })).toBe(false);
  });

  it("does not apply to an ordinary house", () => {
    expect(requiresUsoDeSuelo({ type: "CASA", operation: "VENTA" })).toBe(false);
  });

  it("does not apply to a plain apartment", () => {
    expect(requiresUsoDeSuelo({ type: "DEPARTAMENTO", operation: "VENTA" })).toBe(false);
  });

  it("tolerates missing data", () => {
    expect(requiresUsoDeSuelo({ type: null, operation: null })).toBe(false);
  });
});

describe("isDocumentRequired", () => {
  it("raises the land-use certificate to required when the rule matches", () => {
    expect(
      isDocumentRequired(usoDeSuelo, { type: "CASA_USO_SUELO", operation: "VENTA" }),
    ).toBe(true);
  });

  it("leaves it optional otherwise", () => {
    expect(isDocumentRequired(usoDeSuelo, { type: "CASA", operation: "VENTA" })).toBe(
      false,
    );
  });

  it("does not touch documents without a conditional rule", () => {
    expect(isDocumentRequired(escritura, { type: "CASA", operation: "VENTA" })).toBe(
      true,
    );
  });
});
