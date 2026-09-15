import { describe, expect, it } from "vitest";
import { safeStorageFileName } from "./private-storage";

describe("safeStorageFileName", () => {
  it("quita acentos y espacios, que Storage rechaza como 'Invalid key'", () => {
    expect(safeStorageFileName("ANEXO 2 Identificación ERIKA PATRICIA OLEA DE LA TORRE.pdf")).toBe(
      "ANEXO-2-Identificacion-ERIKA-PATRICIA-OLEA-DE-LA-TORRE.pdf",
    );
    // Forma descompuesta (o + acento combinante), típica de archivos de macOS.
    expect(safeStorageFileName("Identificación.PDF")).toBe("Identificacion.pdf");
  });

  it("conserva nombres ya seguros y da un nombre por defecto si no queda nada", () => {
    expect(safeStorageFileName("escritura_2024-final.pdf")).toBe("escritura_2024-final.pdf");
    expect(safeStorageFileName("ñ.jpg")).toBe("n.jpg");
    expect(safeStorageFileName("¿?.png")).toBe("archivo.png");
    expect(safeStorageFileName("sin-extension")).toBe("sin-extension");
  });
});
