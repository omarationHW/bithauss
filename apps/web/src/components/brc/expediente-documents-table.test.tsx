import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ExpedienteDocumentsTable,
  type ExpedienteTableRow,
} from "./expediente-documents-table";

/* The OCR panel builds a Supabase browser client on mount, which needs env
   vars we do not care about here. The table's contract with it is just "render
   it under the document name". */
vi.mock("@/components/brc/ocr-document-review", () => ({
  OcrDocumentReview: ({ expectedType }: { expectedType: string }) => (
    <div data-testid="ocr-review">{expectedType}</div>
  ),
}));

/* ------------------------------------------------------------------ */
/*  Viewport helper                                                     */
/* ------------------------------------------------------------------ */

function setViewport(wide: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: wide,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  });
}

/* ------------------------------------------------------------------ */
/*  Fixtures                                                            */
/* ------------------------------------------------------------------ */

function makeDoc(overrides: Partial<ExpedienteTableRow["doc"]> = {}) {
  return {
    id: "doc-1",
    file_name: "escritura.pdf",
    file_url: "https://x/storage/v1/object/public/brc-documents/e/d/escritura.pdf",
    status: "RECIBIDO",
    rejection_reason: null,
    owner_instruction: null,
    reviewed_at: null,
    reviewed_by: null,
    reviewer_name: null,
    created_at: "2026-08-01T10:00:00.000Z",
    cert_requested_at: null,
    cert_received_at: null,
    cert_result: null,
    cert_requirement: null,
    notary_legal_opinion: null,
    ocr_detected_type: null,
    ocr_confidence: null,
    ocr_valid: null,
    ocr_extracted_data: null,
    ocr_corrected_data: null,
    ocr_standalone_checks: null,
    ...overrides,
  } as NonNullable<ExpedienteTableRow["doc"]>;
}

const ESCRITURA = {
  id: "dt-1",
  name: "Escritura de Propiedad del Inmueble a Certificar",
  description: null,
  is_required: true,
};

const RESOLUCION = {
  id: "dt-2",
  name: "Resolución Judicial",
  description: "Solo en caso de Usucapión.",
  is_required: false,
};

function baseRows(): ExpedienteTableRow[] {
  return [
    { docType: ESCRITURA, doc: makeDoc() },
    { docType: RESOLUCION, doc: null },
  ];
}

function renderTable(
  overrides: Partial<React.ComponentProps<typeof ExpedienteDocumentsTable>> = {},
) {
  const props: React.ComponentProps<typeof ExpedienteDocumentsTable> = {
    rows: baseRows(),
    isNotario: true,
    isRequester: false,
    canFixDocuments: true,
    notarialCertificate: null,
    actionLoadingId: null,
    openingDocId: null,
    reuploadingTypeId: null,
    onOpenDocument: vi.fn(),
    onApproveDocument: vi.fn(),
    onRejectDocument: vi.fn(),
    onReuploadDocument: vi.fn(),
    onDocumentCorrected: vi.fn(),
    onSaveCertTracking: vi.fn(),
    ...overrides,
  };
  return { ...render(<ExpedienteDocumentsTable {...props} />), props };
}

beforeEach(() => setViewport(true));
afterEach(() => vi.clearAllMocks());

/* ------------------------------------------------------------------ */
/*  Header structure                                                    */
/* ------------------------------------------------------------------ */

describe("ExpedienteDocumentsTable · grouped header", () => {
  it("renders the two named bands with the exact wording from the design", () => {
    renderTable();
    expect(
      screen.getByText("MÓDULO DOCUMENTAL DE NOTARIA"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "MÓDULO DE CERTIFICADOS RECABADOS POR NOTARIA (RPP / PREDIAL / AGUA / OTROS)",
      ),
    ).toBeInTheDocument();
  });

  it("spans 5 / 5 / 2 columns so the bands line up with their columns", () => {
    renderTable();
    const documental = screen.getByText("MÓDULO DOCUMENTAL DE NOTARIA");
    const certificados = screen.getByText(
      "MÓDULO DE CERTIFICADOS RECABADOS POR NOTARIA (RPP / PREDIAL / AGUA / OTROS)",
    );
    expect(documental).toHaveAttribute("colspan", "5");
    expect(documental).toHaveAttribute("scope", "colgroup");
    expect(certificados).toHaveAttribute("colspan", "5");
    expect(certificados).toHaveAttribute("scope", "colgroup");

    // 12 data columns overall, so the bands must add up to 12.
    const headers = screen.getAllByRole("columnheader");
    const colgroups = headers.filter((h) => h.getAttribute("scope") === "colgroup");
    const total = colgroups.reduce(
      (sum, h) => sum + Number(h.getAttribute("colspan") ?? 1),
      0,
    );
    expect(total).toBe(12);
  });

  it("lists the twelve column headers in the order of the design", () => {
    renderTable();
    const labels = screen
      .getAllByRole("columnheader")
      .filter((h) => h.getAttribute("scope") === "col")
      .map((h) => h.textContent);
    expect(labels).toEqual([
      "Documento",
      "Fecha Revisión",
      "Validación de Documentos",
      "Inconsistencia Detectada",
      "Requerimiento al Solicitante",
      "Certificado Solicitado",
      "Certificado Recibido",
      "Resultado",
      "Requerimiento al Solicitante",
      "Dictamen Jurídico de la Notaría",
      "Emisión de Certificado",
      "Nombre del Dictaminador",
    ]);
  });

  it("pins the DOCUMENTO column and the header rows", () => {
    renderTable();
    const documentoHeader = screen
      .getAllByRole("columnheader")
      .find((h) => h.textContent === "Documento")!;
    expect(documentoHeader.className).toContain("sticky");
    expect(documentoHeader.className).toContain("left-0");

    // The body cell must carry the tint itself, otherwise the pinned column
    // is see-through while scrolling.
    const rowHeader = screen.getByRole("rowheader", { name: /Escritura/ });
    expect(rowHeader.className).toContain("sticky");
    expect(rowHeader.className).toContain("left-0");
    expect(rowHeader.className).toMatch(/bg-(white|emerald|red)/);
  });
});

/* ------------------------------------------------------------------ */
/*  Accessibility / scrolling                                           */
/* ------------------------------------------------------------------ */

describe("ExpedienteDocumentsTable · accessibility", () => {
  it("exposes the scroller as a keyboard-reachable labelled region", () => {
    renderTable();
    const region = screen.getByRole("region", {
      name: /Documentos del expediente/i,
    });
    expect(region).toHaveAttribute("tabindex", "0");
    expect(region.className).toContain("overflow-auto");
  });

  it("gives the table an sr-only caption", () => {
    renderTable();
    const caption = screen.getByRole("table").querySelector("caption");
    expect(caption).not.toBeNull();
    expect(caption!.className).toContain("sr-only");
    expect(caption!.textContent).toMatch(/módulo documental/i);
  });

  it("does not rely on colour alone for the review status", () => {
    renderTable();
    expect(screen.getAllByText("Pendiente").length).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------------------------ */
/*  Behaviour                                                           */
/* ------------------------------------------------------------------ */

describe("ExpedienteDocumentsTable · notary actions", () => {
  it("fires onApproveDocument with the document id", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(screen.getByRole("button", { name: /Aprobar/ }));
    expect(props.onApproveDocument).toHaveBeenCalledWith("doc-1");
  });

  it("collects the reason and the requirement before firing onRejectDocument", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();

    await user.click(screen.getByRole("button", { name: /Rechazar/ }));
    await user.type(
      screen.getByLabelText("Inconsistencia detectada"),
      "Boleta vencida",
    );
    await user.type(
      screen.getByLabelText("Requerimiento al solicitante"),
      "Sube la boleta del trimestre en curso",
    );
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(props.onRejectDocument).toHaveBeenCalledWith("doc-1", {
      reason: "Boleta vencida",
      owner_instruction: "Sube la boleta del trimestre en curso",
    });
  });

  it("refuses to confirm a rejection with no reason", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(screen.getByRole("button", { name: /Rechazar/ }));
    expect(screen.getByRole("button", { name: "Confirmar" })).toBeDisabled();
    expect(props.onRejectDocument).not.toHaveBeenCalled();
  });

  it("opens the stored document through the callback (signed URL is minted there)", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(screen.getByRole("button", { name: /escritura\.pdf/ }));
    expect(props.onOpenDocument).toHaveBeenCalledWith(
      "doc-1",
      expect.stringContaining("escritura.pdf"),
    );
  });

  it("saves the collected-certificate block for the notary", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(
      screen.getByRole("button", { name: /Editar certificados recabados/ }),
    );
    await user.selectOptions(
      screen.getByLabelText("Resultado del certificado"),
      "FAVORABLE",
    );
    await user.type(
      screen.getByLabelText("Dictamen jurídico de la notaría"),
      "Sin gravámenes",
    );
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(props.onSaveCertTracking).toHaveBeenCalledWith(
      "doc-1",
      expect.objectContaining({
        cert_result: "FAVORABLE",
        notary_legal_opinion: "Sin gravámenes",
      }),
    );
  });
});

describe("ExpedienteDocumentsTable · role gating", () => {
  it("hides approve/reject and the certificate editor from the applicant", () => {
    renderTable({ isNotario: false, isRequester: true });
    expect(screen.queryByRole("button", { name: /Aprobar/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Rechazar/ })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /Editar certificados recabados/ }),
    ).toBeNull();
  });

  it("offers the applicant a re-upload for a rejected document", () => {
    renderTable({
      isNotario: false,
      isRequester: true,
      rows: [
        {
          docType: ESCRITURA,
          doc: makeDoc({
            status: "RECHAZADO",
            reviewed_at: "2026-08-02T10:00:00.000Z",
            rejection_reason: "Ilegible",
          }),
        },
      ],
    });
    expect(screen.getByText("Rechazado")).toBeInTheDocument();
    expect(screen.getByLabelText(/Volver a subir/)).toBeInTheDocument();
  });

  it("does not offer a re-upload once the expediente is closed", () => {
    renderTable({
      isNotario: false,
      isRequester: true,
      canFixDocuments: false,
      rows: [
        {
          docType: ESCRITURA,
          doc: makeDoc({ status: "RECHAZADO", reviewed_at: "2026-08-02T10:00:00.000Z" }),
        },
      ],
    });
    expect(screen.queryByLabelText(/Volver a subir/)).toBeNull();
  });
});

describe("ExpedienteDocumentsTable · dictaminador and emisión", () => {
  it("shows the persisted reviewer name, not the current user", () => {
    renderTable({
      rows: [
        {
          docType: ESCRITURA,
          doc: makeDoc({
            status: "VALIDADO",
            reviewed_at: "2026-08-02T10:00:00.000Z",
            reviewed_by: "notary-1",
            reviewer_name: "Lic. Jesús Valdez",
          }),
        },
      ],
    });
    expect(screen.getByText("Lic. Jesús Valdez")).toBeInTheDocument();
  });

  it("links the Certificado Notarial once it exists", async () => {
    const user = userEvent.setup();
    const onOpenNotarialCertificate = vi.fn();
    renderTable({
      notarialCertificate: {
        id: "nc-1",
        file_name: "certificado-notarial.pdf",
        file_url: "https://x/certificates/e/certificado-notarial.pdf",
        issued_at: "2026-08-03T10:00:00.000Z",
      },
      onOpenNotarialCertificate,
    });
    const links = screen.getAllByRole("button", { name: /Ver documento/ });
    await user.click(links[0]!);
    expect(onOpenNotarialCertificate).toHaveBeenCalled();
  });
});

/* ------------------------------------------------------------------ */
/*  Responsive                                                          */
/* ------------------------------------------------------------------ */

describe("ExpedienteDocumentsTable · small viewport", () => {
  beforeEach(() => setViewport(false));

  it("renders cards instead of the table", () => {
    renderTable();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByTestId("expediente-documents-cards")).toBeInTheDocument();
  });

  it("keeps one card per document with the same grouped sections", () => {
    renderTable();
    const card = screen.getByRole("article", { name: ESCRITURA.name });
    expect(
      within(card).getByText("MÓDULO DOCUMENTAL DE NOTARIA"),
    ).toBeInTheDocument();
    expect(
      within(card).getByText(
        "MÓDULO DE CERTIFICADOS RECABADOS POR NOTARIA (RPP / PREDIAL / AGUA / OTROS)",
      ),
    ).toBeInTheDocument();
    expect(within(card).getByText("Nombre del dictaminador")).toBeInTheDocument();
  });

  it("still exposes the notary actions", async () => {
    const user = userEvent.setup();
    const { props } = renderTable();
    await user.click(screen.getByRole("button", { name: /Aprobar/ }));
    expect(props.onApproveDocument).toHaveBeenCalledWith("doc-1");
  });
});

describe("ExpedienteDocumentsTable · empty state", () => {
  it("explains that the catalogue is empty rather than rendering an empty table", () => {
    renderTable({ rows: [] });
    expect(
      screen.getByText(/No se encontraron tipos de documentos/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});
