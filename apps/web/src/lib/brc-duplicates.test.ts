import { describe, it, expect } from "vitest";
import { describeBrcDuplicates } from "./brc-duplicates";

describe("describeBrcDuplicates", () => {
  it("is null when nothing is duplicated", () => {
    expect(describeBrcDuplicates([])).toBeNull();
  });

  it("names what is duplicated, capitalised", () => {
    const msg = describeBrcDuplicates([
      { kind: "FOLIO_REAL", document_name: "Escritura de Propiedad del Inmueble a Certificar" },
    ]);
    expect(msg).toMatch(/^El folio real ya está registrado en otro inmueble/);
  });

  it("lists each identifier once even if several documents carry it", () => {
    const msg = describeBrcDuplicates([
      { kind: "FOLIO_REAL", document_name: "Escritura de Propiedad del Inmueble a Certificar" },
      { kind: "FOLIO_REAL", document_name: "Folio Real del Inmueble" },
      { kind: "CUENTA_PREDIAL", document_name: "Última Boleta Predial del Inmueble" },
    ]);
    expect(msg).toMatch(/^El folio real, la cuenta predial ya está/);
  });

  it("names the document for an identical file", () => {
    const msg = describeBrcDuplicates([
      { kind: "ARCHIVO", document_name: "Última Boleta de Agua del Inmueble" },
    ]);
    expect(msg).toMatch(/^El archivo de «Última Boleta de Agua del Inmueble» ya está/);
  });
});
