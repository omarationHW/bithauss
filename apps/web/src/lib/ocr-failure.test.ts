import { describe, expect, it } from "vitest";
import { describeOcrFailure, OCR_MAX_FILE_MB } from "./ocr-validate";

describe("describeOcrFailure", () => {
  it("explica el límite de tamaño con el peso real del archivo", () => {
    const msg = describeOcrFailure(
      400,
      { message: "Validation failed (current file size is 16098976, expected size is less than 15728640)" },
      { size: 16_098_976 },
    );
    expect(msg).toContain("15.4 MB");
    expect(msg).toContain(`${OCR_MAX_FILE_MB} MB`);
    expect(msg).toContain("revisión manual");
  });

  it("distingue formato inválido, sesión y límite de peticiones", () => {
    expect(describeOcrFailure(400, { message: "Validation failed (expected type is pdf)" }, { size: 1 })).toMatch(/PDF, JPG o PNG/);
    expect(describeOcrFailure(401, null, { size: 1 })).toMatch(/sesión/);
    expect(describeOcrFailure(429, null, { size: 1 })).toMatch(/espera un minuto/);
  });

  it("cae al mensaje genérico cuando no hay detalle útil", () => {
    expect(describeOcrFailure(500, null, { size: 1 })).toBe(
      "No se pudo validar automáticamente. Se aceptó para revisión manual.",
    );
  });
});
