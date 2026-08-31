import { describe, it, expect } from "vitest";
import {
  BRC_STATUS,
  BRC_STATUS_LABELS,
  BRC_STATUS_STEPS,
  areRequiredDocumentsValidated,
  canIssueBrc,
  canIssueNotarialCertificate,
  formatCertificateNumber,
  getBrcProgressStep,
  isCertResult,
  isDocumentValidated,
  isTerminalBrcStatus,
  missingRequiredDocuments,
  nextCertificateNumber,
  type DocumentReviewRow,
} from "./brc-notarial";
import { USO_DE_SUELO_DOC } from "./brc-documents";

const HOUSE_SALE = { type: "CASA", operation: "VENTA" };
const OFFICE_SALE = { type: "OFICINA", operation: "VENTA" };

const escritura: DocumentReviewRow = {
  name: "Escritura de Propiedad del Inmueble a Certificar",
  is_required: true,
  status: "VALIDADO",
};
const predial: DocumentReviewRow = {
  name: "Última Boleta Predial del Inmueble",
  is_required: true,
  status: "APROBADO",
};
const optional: DocumentReviewRow = {
  name: "Resolución Judicial",
  is_required: false,
  status: null,
};

/* ------------------------------------------------------------------ */

describe("isDocumentValidated", () => {
  it("accepts both spellings used across the schema", () => {
    expect(isDocumentValidated("VALIDADO")).toBe(true);
    expect(isDocumentValidated("APROBADO")).toBe(true);
  });

  it("rejects anything else, including nullish", () => {
    expect(isDocumentValidated("PENDIENTE")).toBe(false);
    expect(isDocumentValidated("RECHAZADO")).toBe(false);
    expect(isDocumentValidated(null)).toBe(false);
    expect(isDocumentValidated(undefined)).toBe(false);
  });
});

describe("missingRequiredDocuments", () => {
  it("returns nothing when every required document is validated", () => {
    expect(
      missingRequiredDocuments([escritura, predial, optional], HOUSE_SALE),
    ).toEqual([]);
  });

  it("ignores optional documents even when they were never uploaded", () => {
    expect(
      missingRequiredDocuments([escritura, predial, optional], HOUSE_SALE),
    ).not.toContain(optional.name);
  });

  it("flags a required document that has no upload at all", () => {
    const rows = [escritura, { ...predial, status: null }];
    expect(missingRequiredDocuments(rows, HOUSE_SALE)).toEqual([predial.name]);
  });

  it("flags a required document whose latest version was rejected", () => {
    const rows = [escritura, { ...predial, status: "RECHAZADO" }];
    expect(missingRequiredDocuments(rows, HOUSE_SALE)).toEqual([predial.name]);
  });

  it("honours the conditional land-use rule: demanded for an office sale", () => {
    const rows: DocumentReviewRow[] = [
      escritura,
      predial,
      { name: USO_DE_SUELO_DOC, is_required: false, status: null },
    ];
    expect(missingRequiredDocuments(rows, OFFICE_SALE)).toEqual([USO_DE_SUELO_DOC]);
    expect(missingRequiredDocuments(rows, HOUSE_SALE)).toEqual([]);
  });
});

describe("areRequiredDocumentsValidated", () => {
  it("is true when all required documents are cleared", () => {
    expect(areRequiredDocumentsValidated([escritura, predial], HOUSE_SALE)).toBe(true);
  });

  it("is false for an expediente with no required documents at all", () => {
    // A misconfigured catalogue must not turn into a free certificate.
    expect(areRequiredDocumentsValidated([optional], HOUSE_SALE)).toBe(false);
    expect(areRequiredDocumentsValidated([], HOUSE_SALE)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */

describe("canIssueNotarialCertificate", () => {
  const base = {
    role: "NOTARIO",
    userId: "notary-1",
    assignedNotaryId: "notary-1",
    status: BRC_STATUS.EN_REVISION,
    rows: [escritura, predial],
    property: HOUSE_SALE,
  };

  it("allows the assigned notary once every required document is validated", () => {
    expect(canIssueNotarialCertificate(base)).toMatchObject({
      allowed: true,
      reason: null,
    });
  });

  it("refuses a notary who is not the assigned one", () => {
    expect(
      canIssueNotarialCertificate({ ...base, assignedNotaryId: "notary-2" }),
    ).toMatchObject({ allowed: false, reason: "NOTARIO_NO_ASIGNADO" });
  });

  it("refuses the applicant and the BRC operator", () => {
    for (const role of ["VENDEDOR", "OPERADOR_BRC", "BROKER"]) {
      expect(canIssueNotarialCertificate({ ...base, role })).toMatchObject({
        allowed: false,
        reason: "ROL_NO_AUTORIZADO",
      });
    }
  });

  it("lets an ADMIN through without being the assigned notary", () => {
    expect(
      canIssueNotarialCertificate({
        ...base,
        role: "ADMIN",
        userId: "admin-1",
        assignedNotaryId: "notary-1",
      }),
    ).toMatchObject({ allowed: true });
  });

  it("refuses while required documents are still pending", () => {
    expect(
      canIssueNotarialCertificate({
        ...base,
        rows: [escritura, { ...predial, status: "PENDIENTE" }],
      }),
    ).toMatchObject({ allowed: false, reason: "DOCUMENTOS_PENDIENTES" });
  });

  it("refuses on a closed expediente", () => {
    for (const status of [BRC_STATUS.CERTIFICADO, BRC_STATUS.RECHAZADO]) {
      expect(canIssueNotarialCertificate({ ...base, status })).toMatchObject({
        allowed: false,
        reason: "EXPEDIENTE_CERRADO",
      });
    }
  });

  it("returns Spanish copy alongside the machine reason", () => {
    const result = canIssueNotarialCertificate({ ...base, role: "COMPRADOR" });
    expect(result.message).toMatch(/rol no puede/i);
  });
});

/* ------------------------------------------------------------------ */

describe("canIssueBrc", () => {
  const base = {
    role: "OPERADOR_BRC",
    status: BRC_STATUS.PENDIENTE_EMISION_BRC,
    hasNotarialCertificate: true,
  };

  it("allows ADMIN and OPERADOR_BRC", () => {
    expect(canIssueBrc(base)).toMatchObject({ allowed: true });
    expect(canIssueBrc({ ...base, role: "ADMIN" })).toMatchObject({ allowed: true });
  });

  it("NEVER allows the notary — that is the whole point of the split", () => {
    expect(canIssueBrc({ ...base, role: "NOTARIO" })).toMatchObject({
      allowed: false,
      reason: "ROL_NO_AUTORIZADO",
    });
  });

  it("refuses without a Certificado Notarial to stand on", () => {
    expect(canIssueBrc({ ...base, hasNotarialCertificate: false })).toMatchObject({
      allowed: false,
      reason: "CERTIFICADO_NOTARIAL_FALTANTE",
    });
  });

  it("refuses before the notary has signed off", () => {
    expect(
      canIssueBrc({ ...base, status: BRC_STATUS.VALIDACION_NOTARIAL }),
    ).toMatchObject({ allowed: false, reason: "ESTADO_INVALIDO" });
  });

  it("refuses to certify twice", () => {
    expect(canIssueBrc({ ...base, status: BRC_STATUS.CERTIFICADO })).toMatchObject({
      allowed: false,
      reason: "EXPEDIENTE_CERRADO",
    });
  });

  it("refuses an unknown or missing role", () => {
    expect(canIssueBrc({ ...base, role: null })).toMatchObject({
      allowed: false,
      reason: "ROL_NO_AUTORIZADO",
    });
  });
});

/* ------------------------------------------------------------------ */

describe("status helpers", () => {
  it("labels the new state unambiguously in Spanish", () => {
    expect(BRC_STATUS_LABELS.PENDIENTE_EMISION_BRC).toBe(
      "Certificado notarial emitido · pendiente de BRC",
    );
  });

  it("places PENDIENTE_EMISION_BRC between validation and the BRC", () => {
    const keys = BRC_STATUS_STEPS.map((s) => s.key);
    expect(keys.indexOf("PENDIENTE_EMISION_BRC")).toBeGreaterThan(
      keys.indexOf("VALIDACION_NOTARIAL"),
    );
    expect(keys.indexOf("PENDIENTE_EMISION_BRC")).toBeLessThan(
      keys.indexOf("CERTIFICADO"),
    );
  });

  it("treats only CERTIFICADO and RECHAZADO as terminal", () => {
    expect(isTerminalBrcStatus("CERTIFICADO")).toBe(true);
    expect(isTerminalBrcStatus("RECHAZADO")).toBe(true);
    expect(isTerminalBrcStatus("PENDIENTE_EMISION_BRC")).toBe(false);
  });

  it("maps RECHAZADO off the stepper and unknown states to the start", () => {
    expect(getBrcProgressStep("RECHAZADO")).toBe(-1);
    expect(getBrcProgressStep("BORRADOR")).toBe(0);
    expect(getBrcProgressStep("PENDIENTE_EMISION_BRC")).toBe(3);
  });
});

/* ------------------------------------------------------------------ */

describe("nextCertificateNumber", () => {
  it("starts at 000001 when nothing was ever issued", () => {
    expect(nextCertificateNumber([], 2026)).toBe("BRC-2026-000001");
  });

  it("continues from the highest folio of the year", () => {
    expect(
      nextCertificateNumber(["BRC-2026-000001", "BRC-2026-000007", "BRC-2026-000003"], 2026),
    ).toBe("BRC-2026-000008");
  });

  it("restarts the sequence on a new year", () => {
    expect(nextCertificateNumber(["BRC-2025-000432"], 2026)).toBe("BRC-2026-000001");
  });

  it("ignores malformed folios instead of trusting them", () => {
    expect(
      nextCertificateNumber(["BRC-2026-12", "brc-2026-000009", "", "BRC-2026-000002"], 2026),
    ).toBe("BRC-2026-000003");
  });

  it("pads to six digits", () => {
    expect(formatCertificateNumber(2026, 42)).toBe("BRC-2026-000042");
  });
});

describe("isCertResult", () => {
  it("accepts the three catalogued outcomes only", () => {
    expect(isCertResult("FAVORABLE")).toBe(true);
    expect(isCertResult("DESFAVORABLE")).toBe(true);
    expect(isCertResult("SIN_RESULTADO")).toBe(true);
    expect(isCertResult("favorable")).toBe(false);
    expect(isCertResult(null)).toBe(false);
  });
});
