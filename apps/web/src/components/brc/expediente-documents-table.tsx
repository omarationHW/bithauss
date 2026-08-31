"use client";

/**
 * "Documentos del Expediente" — the notary's working surface.
 *
 * The table carries three grouped blocks, and the grouping is not decoration:
 * they are three different jobs, done at different times, by different people.
 *
 *   1. MÓDULO DOCUMENTAL DE NOTARÍA — reviewing what the applicant uploaded.
 *   2. MÓDULO DE CERTIFICADOS RECABADOS POR NOTARÍA — the certificates the
 *      notary requests from third parties (RPP, Predial, Agua, otros) for each
 *      requirement, and what came back.
 *   3. EMISIÓN DE CERTIFICADO / NOMBRE DEL DICTAMINADOR — where the notarial
 *      certificate stands, and who actually ruled.
 *
 * Twelve columns do not fit on a laptop, so this lives in its own horizontal
 * scroller (never the page's) with the DOCUMENTO column pinned to the left and
 * the two header rows pinned to the top; below `lg` the whole thing becomes one
 * card per document, because a 2000px table on a phone is unreadable, not
 * responsive.
 *
 * Extracted from the expediente page, which had grown past 1500 lines.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileText,
  Loader2,
  Pencil,
  Upload,
  XCircle,
} from "lucide-react";
import {
  OcrDocumentReview,
  type OcrStandaloneCheck,
} from "@/components/brc/ocr-document-review";
import {
  CERT_RESULTS,
  CERT_RESULT_LABELS,
  isDocumentValidated,
  type CertResult,
} from "@/lib/brc-notarial";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface ExpedienteDocumentTypeRow {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
}

export interface ExpedienteDocumentRow {
  id: string;
  file_name: string;
  file_url: string | null;
  status: string;
  rejection_reason: string | null;
  owner_instruction: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  reviewer_name: string | null;
  created_at: string;
  /* Certificates the notary collects from third parties. */
  cert_requested_at: string | null;
  cert_received_at: string | null;
  cert_result: string | null;
  cert_requirement: string | null;
  notary_legal_opinion: string | null;
  /* OCR analysis, rendered by OcrDocumentReview. */
  ocr_detected_type: string | null;
  ocr_confidence: string | null;
  ocr_valid: boolean | null;
  ocr_extracted_data: Record<string, unknown> | null;
  ocr_corrected_data: Record<string, unknown> | null;
  ocr_standalone_checks: OcrStandaloneCheck[] | null;
}

export interface ExpedienteTableRow {
  docType: ExpedienteDocumentTypeRow;
  doc: ExpedienteDocumentRow | null;
}

/** Fields of the green block the notary can edit. */
export interface CertTrackingPatch {
  cert_requested_at: string | null;
  cert_received_at: string | null;
  cert_result: string | null;
  cert_requirement: string | null;
  notary_legal_opinion: string | null;
}

export interface NotarialCertificateSummary {
  id: string;
  file_name: string;
  file_url: string;
  issued_at: string;
}

export interface ExpedienteDocumentsTableProps {
  rows: ExpedienteTableRow[];
  isNotario: boolean;
  /** The applicant who filed the request: the only one who may re-upload. */
  isRequester: boolean;
  /** False once the expediente is closed. */
  canFixDocuments: boolean;
  /** The current Certificado Notarial, when the notary already issued it. */
  notarialCertificate: NotarialCertificateSummary | null;
  /** id of the document whose approve/reject call is in flight. */
  actionLoadingId: string | null;
  /** id of the document whose signed URL is being minted. */
  openingDocId: string | null;
  /** document type whose corrected file is uploading. */
  reuploadingTypeId: string | null;
  /** id of the document whose certificate tracking is being saved. */
  savingTrackingDocId?: string | null;
  onOpenDocument: (docId: string, fileUrl: string) => void;
  onApproveDocument: (docId: string) => void;
  onRejectDocument: (
    docId: string,
    payload: { reason: string; owner_instruction?: string },
  ) => void;
  onReuploadDocument: (documentTypeId: string, file: File) => void;
  onDocumentCorrected: (
    docId: string,
    correctedData: Record<string, unknown>,
  ) => void;
  onSaveCertTracking?: (docId: string, patch: CertTrackingPatch) => void;
  onOpenNotarialCertificate?: () => void;
}

/* ------------------------------------------------------------------ */
/*  Column model                                                       */
/* ------------------------------------------------------------------ */
/* Kept as data so <colgroup>, the group bands (colSpan) and the header
   cells can never drift apart — misaligned bands were the first thing that
   made the old table look broken. */

interface ColumnDef {
  key: string;
  label: string;
  /** px; the table is fixed-layout so these are honoured exactly. */
  width: number;
}

const DOCUMENTAL_COLUMNS: ColumnDef[] = [
  { key: "documento", label: "Documento", width: 300 },
  { key: "fecha_revision", label: "Fecha Revisión", width: 120 },
  { key: "validacion", label: "Validación de Documentos", width: 150 },
  { key: "inconsistencia", label: "Inconsistencia Detectada", width: 220 },
  { key: "requerimiento_doc", label: "Requerimiento al Solicitante", width: 220 },
];

const CERTIFICADOS_COLUMNS: ColumnDef[] = [
  { key: "cert_solicitado", label: "Certificado Solicitado", width: 150 },
  { key: "cert_recibido", label: "Certificado Recibido", width: 150 },
  { key: "cert_resultado", label: "Resultado", width: 150 },
  { key: "cert_requerimiento", label: "Requerimiento al Solicitante", width: 220 },
  { key: "dictamen", label: "Dictamen Jurídico de la Notaría", width: 240 },
];

const EMISION_COLUMNS: ColumnDef[] = [
  { key: "emision", label: "Emisión de Certificado", width: 190 },
  { key: "dictaminador", label: "Nombre del Dictaminador", width: 190 },
];

const ALL_COLUMNS: ColumnDef[] = [
  ...DOCUMENTAL_COLUMNS,
  ...CERTIFICADOS_COLUMNS,
  ...EMISION_COLUMNS,
];

const TABLE_WIDTH = ALL_COLUMNS.reduce((sum, c) => sum + c.width, 0);

const BAND_DOCUMENTAL = "MÓDULO DOCUMENTAL DE NOTARIA";
const BAND_CERTIFICADOS =
  "MÓDULO DE CERTIFICADOS RECABADOS POR NOTARIA (RPP / PREDIAL / AGUA / OTROS)";

const BLUE_GRADIENT =
  "linear-gradient(135deg, hsl(221 83% 53%), hsl(210 80% 45%))";
const GREEN_GRADIENT =
  "linear-gradient(135deg, hsl(160 84% 39%), hsl(158 75% 32%))";
const NAVY = "hsl(222 47% 24%)";

/** Height of the group band row; the column header row sticks right below it. */
const BAND_ROW_HEIGHT = 30;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** ISO timestamp -> value for <input type="date">. */
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "";
}

/** <input type="date"> value -> ISO timestamp (midnight local, UTC-encoded). */
function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

const LG_BREAKPOINT = "(min-width: 1024px)";

/**
 * Which layout to render. CSS alone would mean keeping both trees in the DOM,
 * duplicating every control for screen readers; this renders exactly one.
 * Defaults to the table when matchMedia is unavailable.
 */
function useIsWideViewport(): boolean {
  const [wide, setWide] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return true;
    return window.matchMedia(LG_BREAKPOINT).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function")
      return;
    const mql = window.matchMedia(LG_BREAKPOINT);
    setWide(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setWide(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return wide;
}

/* ------------------------------------------------------------------ */
/*  Shared cell fragments                                              */
/* ------------------------------------------------------------------ */

function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "amber" | "red" | "blue" | "gray";
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    gray: "bg-gray-50 text-gray-500 border-gray-200",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

function Empty() {
  return (
    <span className="text-[10px] text-gray-300" aria-label="Sin dato">
      —
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Row view-model                                                     */
/* ------------------------------------------------------------------ */

interface RowState {
  hasFile: boolean;
  isReviewed: boolean;
  isApproved: boolean;
  isRejected: boolean;
}

function readRowState(doc: ExpedienteDocumentRow | null): RowState {
  return {
    hasFile: !!doc,
    isReviewed: doc?.reviewed_at != null,
    isApproved: isDocumentValidated(doc?.status),
    isRejected: doc?.status === "RECHAZADO",
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function ExpedienteDocumentsTable(props: ExpedienteDocumentsTableProps) {
  const {
    rows,
    isNotario,
    isRequester,
    canFixDocuments,
    notarialCertificate,
    actionLoadingId,
    openingDocId,
    reuploadingTypeId,
    savingTrackingDocId = null,
    onOpenDocument,
    onApproveDocument,
    onRejectDocument,
    onReuploadDocument,
    onDocumentCorrected,
    onSaveCertTracking,
    onOpenNotarialCertificate,
  } = props;

  const isWide = useIsWideViewport();

  /* -- rejection editor (moved out of the page: it is table-local UI) -- */
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectInstruction, setRejectInstruction] = useState("");

  const startRejecting = useCallback((doc: ExpedienteDocumentRow) => {
    setRejectingDocId(doc.id);
    setRejectReason(doc.rejection_reason ?? "");
    setRejectInstruction(doc.owner_instruction ?? "");
  }, []);

  const cancelRejecting = useCallback(() => {
    setRejectingDocId(null);
    setRejectReason("");
    setRejectInstruction("");
  }, []);

  const confirmRejecting = useCallback(
    (docId: string) => {
      if (!rejectReason.trim()) return;
      onRejectDocument(docId, {
        reason: rejectReason.trim(),
        owner_instruction: rejectInstruction.trim() || undefined,
      });
      cancelRejecting();
    },
    [rejectReason, rejectInstruction, onRejectDocument, cancelRejecting],
  );

  /* -- collected-certificates editor -- */
  const [trackingDocId, setTrackingDocId] = useState<string | null>(null);
  const [trackingDraft, setTrackingDraft] = useState<CertTrackingPatch>({
    cert_requested_at: null,
    cert_received_at: null,
    cert_result: null,
    cert_requirement: null,
    notary_legal_opinion: null,
  });

  const startTracking = useCallback((doc: ExpedienteDocumentRow) => {
    setTrackingDocId(doc.id);
    setTrackingDraft({
      cert_requested_at: doc.cert_requested_at,
      cert_received_at: doc.cert_received_at,
      cert_result: doc.cert_result,
      cert_requirement: doc.cert_requirement,
      notary_legal_opinion: doc.notary_legal_opinion,
    });
  }, []);

  const cancelTracking = useCallback(() => setTrackingDocId(null), []);

  const saveTracking = useCallback(
    (docId: string) => {
      onSaveCertTracking?.(docId, trackingDraft);
      setTrackingDocId(null);
    },
    [onSaveCertTracking, trackingDraft],
  );

  const canEditTracking = isNotario && canFixDocuments && !!onSaveCertTracking;

  /* -- "there is more to the right" affordance -- */
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [showRightFade, setShowRightFade] = useState(false);

  const syncFade = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // 2px of slack: sub-pixel widths otherwise leave the fade permanently on.
    setShowRightFade(el.scrollWidth - el.clientWidth - el.scrollLeft > 2);
  }, []);

  useEffect(() => {
    if (!isWide) return;
    syncFade();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncFade, { passive: true });
    window.addEventListener("resize", syncFade);
    return () => {
      el.removeEventListener("scroll", syncFade);
      window.removeEventListener("resize", syncFade);
    };
  }, [isWide, syncFade, rows.length]);

  /* ---------------------------------------------------------------- */

  if (rows.length === 0) {
    return (
      <div className="mx-6 mb-6 rounded-xl bg-gray-50 p-8 text-center">
        <FileText className="mx-auto mb-2 h-10 w-10 text-gray-300" />
        <p className="text-sm text-gray-400">
          No se encontraron tipos de documentos.
        </p>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Cell renderers shared by table and cards                         */
  /* ---------------------------------------------------------------- */

  function renderValidacion(state: RowState) {
    return state.isReviewed ? (
      <StatusPill tone="green">Realizado</StatusPill>
    ) : (
      <StatusPill tone="amber">Pendiente</StatusPill>
    );
  }

  function renderDocumentActions(
    docType: ExpedienteDocumentTypeRow,
    doc: ExpedienteDocumentRow | null,
    state: RowState,
  ) {
    if (state.isApproved) return <StatusPill tone="green">Aprobado</StatusPill>;

    if (state.isRejected) {
      return (
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone="red">Rechazado</StatusPill>
          {isRequester && canFixDocuments && (
            <label className="flex cursor-pointer items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-600 transition-all hover:bg-blue-100 focus-within:ring-2 focus-within:ring-blue-300">
              {reuploadingTypeId === docType.id ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Upload className="h-3 w-3" />
              )}
              Volver a subir
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                className="sr-only"
                aria-label={`Volver a subir ${docType.name}`}
                disabled={reuploadingTypeId !== null}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) onReuploadDocument(docType.id, f);
                }}
              />
            </label>
          )}
        </div>
      );
    }

    if (doc && isNotario && !isDocumentValidated(doc.status)) {
      return (
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => onApproveDocument(doc.id)}
            disabled={actionLoadingId === doc.id}
            className="flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-600 transition-all hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
          >
            {actionLoadingId === doc.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <CheckCircle2 className="h-3 w-3" />
            )}
            Aprobar
          </button>
          <button
            type="button"
            onClick={() => startRejecting(doc)}
            disabled={actionLoadingId === doc.id}
            className="flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 transition-all hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
          >
            <XCircle className="h-3 w-3" />
            Rechazar
          </button>
        </div>
      );
    }

    return <Empty />;
  }

  function renderInconsistencia(
    doc: ExpedienteDocumentRow | null,
    state: RowState,
    isRejecting: boolean,
  ) {
    if (isRejecting && doc) {
      return (
        <div className="space-y-1">
          <label className="sr-only" htmlFor={`reason-${doc.id}`}>
            Inconsistencia detectada
          </label>
          <textarea
            id={`reason-${doc.id}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Describir la inconsistencia..."
            rows={2}
            autoFocus
            className="w-full resize-none rounded-md border border-red-200 px-2 py-1.5 text-[11px] text-gray-800 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100"
          />
        </div>
      );
    }
    if (state.isRejected && doc?.rejection_reason) {
      return (
        <p className="text-[11px] leading-relaxed text-red-700">
          {doc.rejection_reason}
        </p>
      );
    }
    return <Empty />;
  }

  function renderRequerimientoDoc(
    doc: ExpedienteDocumentRow | null,
    state: RowState,
    isRejecting: boolean,
  ) {
    if (isRejecting && doc) {
      return (
        <div className="space-y-1.5">
          <label className="sr-only" htmlFor={`instruction-${doc.id}`}>
            Requerimiento al solicitante
          </label>
          <textarea
            id={`instruction-${doc.id}`}
            value={rejectInstruction}
            onChange={(e) => setRejectInstruction(e.target.value)}
            placeholder="Requerimiento para el solicitante..."
            rows={2}
            className="w-full resize-none rounded-md border border-red-200 px-2 py-1.5 text-[11px] text-gray-800 outline-none focus:border-red-300 focus:ring-1 focus:ring-red-100"
          />
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => confirmRejecting(doc.id)}
              disabled={!rejectReason.trim() || actionLoadingId === doc.id}
              className="rounded-md bg-red-600 px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={cancelRejecting}
              className="rounded-md border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition-all hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    }
    if (state.isRejected && doc?.owner_instruction) {
      return (
        <p className="text-[11px] leading-relaxed text-red-700">
          {doc.owner_instruction}
        </p>
      );
    }
    return <Empty />;
  }

  function renderCertResult(doc: ExpedienteDocumentRow | null) {
    if (!doc?.cert_result) return <Empty />;
    const tone =
      doc.cert_result === "FAVORABLE"
        ? "green"
        : doc.cert_result === "DESFAVORABLE"
          ? "red"
          : "gray";
    return (
      <StatusPill tone={tone}>
        {CERT_RESULT_LABELS[doc.cert_result as CertResult] ?? doc.cert_result}
      </StatusPill>
    );
  }

  function renderEmision(state: RowState) {
    // The column reflects the expediente-level Certificado Notarial: a
    // document only counts towards it once it has been ruled favourably.
    if (notarialCertificate) {
      return (
        <div className="flex flex-col items-start gap-1">
          <StatusPill tone="blue">Certificado notarial</StatusPill>
          {onOpenNotarialCertificate && (
            <button
              type="button"
              onClick={onOpenNotarialCertificate}
              className="flex items-center gap-1 text-[10px] font-semibold text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
            >
              <Download className="h-3 w-3" />
              Ver documento
            </button>
          )}
        </div>
      );
    }
    if (state.isApproved) return <StatusPill tone="amber">Por emitir</StatusPill>;
    return <Empty />;
  }

  function renderDictaminador(doc: ExpedienteDocumentRow | null, state: RowState) {
    if (!(state.isApproved || state.isRejected)) return <Empty />;
    // Persisted at review time. Older rows have no name stored; say so instead
    // of showing whoever happens to be looking at the screen.
    return (
      <span className="text-[11px] text-gray-700">
        {doc?.reviewer_name ?? "Notaría"}
      </span>
    );
  }

  function renderTrackingEditor(doc: ExpedienteDocumentRow) {
    return (
      <div className="space-y-1.5">
        <label className="sr-only" htmlFor={`cert-result-${doc.id}`}>
          Resultado del certificado
        </label>
        <select
          id={`cert-result-${doc.id}`}
          value={trackingDraft.cert_result ?? ""}
          onChange={(e) =>
            setTrackingDraft((d) => ({
              ...d,
              cert_result: e.target.value || null,
            }))
          }
          className="w-full rounded-md border border-emerald-200 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-200"
        >
          <option value="">Sin capturar</option>
          {CERT_RESULTS.map((r) => (
            <option key={r} value={r}>
              {CERT_RESULT_LABELS[r]}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => saveTracking(doc.id)}
            disabled={savingTrackingDocId === doc.id}
            className="rounded-md bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white transition-all hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:opacity-50"
          >
            {savingTrackingDocId === doc.id ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={cancelTracking}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-[10px] font-semibold text-gray-500 transition-all hover:bg-gray-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  function renderDocumentCell(
    docType: ExpedienteDocumentTypeRow,
    doc: ExpedienteDocumentRow | null,
  ) {
    return (
      <div>
        <p className="text-[12px] font-bold leading-tight text-gray-900">
          {docType.name}
        </p>
        {!docType.is_required && docType.description && (
          <span className="block text-[10px] leading-tight text-amber-600">
            {docType.description}
          </span>
        )}
        {doc?.file_url && (
          <button
            type="button"
            onClick={() => onOpenDocument(doc.id, doc.file_url!)}
            disabled={openingDocId === doc.id}
            className="mt-1 flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 disabled:opacity-60"
          >
            {openingDocId === doc.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Download className="h-3 w-3" />
            )}
            {doc.file_name}
          </button>
        )}
        {doc && (
          <OcrDocumentReview
            doc={doc}
            expectedType={docType.name}
            isNotario={isNotario}
            onCorrected={onDocumentCorrected}
          />
        )}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Cards (below lg)                                                 */
  /* ---------------------------------------------------------------- */

  if (!isWide) {
    return (
      <div className="space-y-3 px-4 pb-6" data-testid="expediente-documents-cards">
        {rows.map(({ docType, doc }) => {
          const state = readRowState(doc);
          const isRejecting = !!doc && rejectingDocId === doc.id;
          const isTracking = !!doc && trackingDocId === doc.id;
          return (
            <article
              key={docType.id}
              aria-label={docType.name}
              className={`rounded-xl border p-4 shadow-sm ${
                state.isRejected
                  ? "border-red-200 bg-red-50/40"
                  : state.isApproved
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-gray-100 bg-white"
              }`}
            >
              {renderDocumentCell(docType, doc)}

              <section className="mt-3 border-t border-gray-100 pt-3">
                <h4 className="mb-2 text-[10px] font-bold uppercase tracking-wider text-blue-600">
                  {BAND_DOCUMENTAL}
                </h4>
                <dl className="space-y-2 text-[11px]">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500">Fecha revisión</dt>
                    <dd className="text-gray-700">
                      {formatDate(doc?.reviewed_at ?? doc?.created_at ?? null)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500">Validación de documentos</dt>
                    <dd>{renderValidacion(state)}</dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Inconsistencia detectada</dt>
                    <dd className="mt-1">
                      {renderInconsistencia(doc, state, isRejecting)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Requerimiento al solicitante</dt>
                    <dd className="mt-1">
                      {renderRequerimientoDoc(doc, state, isRejecting)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Resultado</dt>
                    <dd className="mt-1">
                      {renderDocumentActions(docType, doc, state)}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="mt-3 border-t border-gray-100 pt-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">
                    {BAND_CERTIFICADOS}
                  </h4>
                  {canEditTracking && doc && !isTracking && (
                    <button
                      type="button"
                      onClick={() => startTracking(doc)}
                      aria-label={`Editar certificados recabados de ${docType.name}`}
                      className="flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-50"
                    >
                      <Pencil className="h-3 w-3" />
                      Editar
                    </button>
                  )}
                </div>
                {isTracking && doc ? (
                  renderTrackingEditor(doc)
                ) : (
                  <dl className="space-y-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Certificado solicitado</dt>
                      <dd className="text-gray-700">
                        {formatDate(doc?.cert_requested_at ?? null)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Certificado recibido</dt>
                      <dd className="text-gray-700">
                        {formatDate(doc?.cert_received_at ?? null)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Resultado</dt>
                      <dd>{renderCertResult(doc)}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Requerimiento al solicitante</dt>
                      <dd className="mt-1 text-gray-700">
                        {doc?.cert_requirement || <Empty />}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">
                        Dictamen jurídico de la notaría
                      </dt>
                      <dd className="mt-1 text-gray-700">
                        {doc?.notary_legal_opinion || <Empty />}
                      </dd>
                    </div>
                  </dl>
                )}
              </section>

              <section className="mt-3 flex items-start justify-between gap-3 border-t border-gray-100 pt-3 text-[11px]">
                <div>
                  <p className="text-gray-500">Emisión de certificado</p>
                  <div className="mt-1">{renderEmision(state)}</div>
                </div>
                <div className="text-right">
                  <p className="text-gray-500">Nombre del dictaminador</p>
                  <div className="mt-1">{renderDictaminador(doc, state)}</div>
                </div>
              </section>
            </article>
          );
        })}
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  Table (lg and up)                                                */
  /* ---------------------------------------------------------------- */

  return (
    <div className="relative" data-testid="expediente-documents-table">
      <div
        ref={scrollerRef}
        role="region"
        aria-label="Documentos del expediente. Usa las flechas para desplazarte horizontalmente."
        tabIndex={0}
        className="max-h-[70vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      >
        <table
          className="border-separate border-spacing-0 text-left"
          style={{ tableLayout: "fixed", width: TABLE_WIDTH }}
        >
          <caption className="sr-only">
            Documentos del expediente: módulo documental de notaría, módulo de
            certificados recabados por notaría y emisión del certificado.
          </caption>

          <colgroup>
            {ALL_COLUMNS.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>

          <thead>
            {/* Group bands */}
            <tr className="text-[10px] font-bold uppercase tracking-wider text-white">
              <th
                scope="colgroup"
                colSpan={DOCUMENTAL_COLUMNS.length}
                className="sticky left-0 top-0 z-30 px-4 text-center"
                style={{ background: BLUE_GRADIENT, height: BAND_ROW_HEIGHT }}
              >
                {BAND_DOCUMENTAL}
              </th>
              <th
                scope="colgroup"
                colSpan={CERTIFICADOS_COLUMNS.length}
                className="sticky top-0 z-20 px-4 text-center"
                style={{ background: GREEN_GRADIENT, height: BAND_ROW_HEIGHT }}
              >
                {BAND_CERTIFICADOS}
              </th>
              <th
                scope="colgroup"
                colSpan={EMISION_COLUMNS.length}
                className="sticky top-0 z-20 bg-white px-4"
                style={{ height: BAND_ROW_HEIGHT }}
              >
                <span className="sr-only">Emisión del certificado y dictaminador</span>
              </th>
            </tr>

            {/* Column headers */}
            <tr className="text-[10px] font-bold uppercase leading-tight tracking-wider text-white">
              {ALL_COLUMNS.map((col, idx) => {
                const isDocumental = idx < DOCUMENTAL_COLUMNS.length;
                const isCertificados =
                  idx >= DOCUMENTAL_COLUMNS.length &&
                  idx < DOCUMENTAL_COLUMNS.length + CERTIFICADOS_COLUMNS.length;
                const isEmision = col.key === "emision";
                const background = isDocumental
                  ? BLUE_GRADIENT
                  : isCertificados
                    ? GREEN_GRADIENT
                    : isEmision
                      ? NAVY
                      : GREEN_GRADIENT;
                const sticky = idx === 0;
                return (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-3 py-3 align-middle ${
                      sticky
                        ? "sticky left-0 z-30 border-r border-white/25"
                        : "sticky z-20"
                    }`}
                    style={{ background, top: BAND_ROW_HEIGHT }}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {rows.map(({ docType, doc }) => {
              const state = readRowState(doc);
              const isRejecting = !!doc && rejectingDocId === doc.id;
              const isTracking = !!doc && trackingDocId === doc.id;

              /* The row tint has to be repeated on the sticky cell: a
                 <tr> background does not paint under a sticky <td>, so the
                 pinned column showed the scrolling content through it. */
              const rowTint = state.isRejected
                ? "bg-red-50"
                : state.isApproved
                  ? "bg-emerald-50/60"
                  : "bg-white";

              const cellBase = "border-b border-gray-100 px-3 py-3 align-top";

              return (
                <tr key={docType.id} className={`group text-xs ${rowTint}`}>
                  {/* DOCUMENTO — pinned */}
                  <th
                    scope="row"
                    className={`${cellBase} sticky left-0 z-10 border-r border-gray-200 px-4 text-left font-normal ${rowTint}`}
                  >
                    {renderDocumentCell(docType, doc)}
                  </th>

                  {/* FECHA REVISIÓN */}
                  <td className={`${cellBase} text-gray-600`}>
                    {formatDate(doc?.reviewed_at ?? doc?.created_at ?? null)}
                  </td>

                  {/* VALIDACIÓN DE DOCUMENTOS */}
                  <td className={cellBase}>{renderValidacion(state)}</td>

                  {/* INCONSISTENCIA DETECTADA */}
                  <td className={cellBase}>
                    {renderInconsistencia(doc, state, isRejecting)}
                  </td>

                  {/* REQUERIMIENTO AL SOLICITANTE (documental) */}
                  <td className={cellBase}>
                    <div className="space-y-1.5">
                      {renderRequerimientoDoc(doc, state, isRejecting)}
                      {!isRejecting && renderDocumentActions(docType, doc, state)}
                    </div>
                  </td>

                  {/* CERTIFICADO SOLICITADO */}
                  <td className={`${cellBase} text-gray-600`}>
                    {isTracking && doc ? (
                      <>
                        <label className="sr-only" htmlFor={`cert-req-${doc.id}`}>
                          Fecha de solicitud del certificado
                        </label>
                        <input
                          id={`cert-req-${doc.id}`}
                          type="date"
                          value={toDateInputValue(trackingDraft.cert_requested_at)}
                          onChange={(e) =>
                            setTrackingDraft((d) => ({
                              ...d,
                              cert_requested_at: fromDateInputValue(e.target.value),
                            }))
                          }
                          className="w-full rounded-md border border-emerald-200 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </>
                    ) : doc?.cert_requested_at ? (
                      formatDate(doc.cert_requested_at)
                    ) : (
                      <Empty />
                    )}
                  </td>

                  {/* CERTIFICADO RECIBIDO */}
                  <td className={`${cellBase} text-gray-600`}>
                    {isTracking && doc ? (
                      <>
                        <label className="sr-only" htmlFor={`cert-rec-${doc.id}`}>
                          Fecha de recepción del certificado
                        </label>
                        <input
                          id={`cert-rec-${doc.id}`}
                          type="date"
                          value={toDateInputValue(trackingDraft.cert_received_at)}
                          onChange={(e) =>
                            setTrackingDraft((d) => ({
                              ...d,
                              cert_received_at: fromDateInputValue(e.target.value),
                            }))
                          }
                          className="w-full rounded-md border border-emerald-200 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </>
                    ) : doc?.cert_received_at ? (
                      formatDate(doc.cert_received_at)
                    ) : (
                      <Empty />
                    )}
                  </td>

                  {/* RESULTADO */}
                  <td className={cellBase}>
                    {isTracking && doc
                      ? renderTrackingEditor(doc)
                      : renderCertResult(doc)}
                  </td>

                  {/* REQUERIMIENTO AL SOLICITANTE (certificados) */}
                  <td className={`${cellBase} text-gray-700`}>
                    {isTracking && doc ? (
                      <>
                        <label className="sr-only" htmlFor={`cert-reqt-${doc.id}`}>
                          Requerimiento al solicitante por certificado
                        </label>
                        <textarea
                          id={`cert-reqt-${doc.id}`}
                          rows={2}
                          value={trackingDraft.cert_requirement ?? ""}
                          onChange={(e) =>
                            setTrackingDraft((d) => ({
                              ...d,
                              cert_requirement: e.target.value || null,
                            }))
                          }
                          className="w-full resize-none rounded-md border border-emerald-200 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </>
                    ) : doc?.cert_requirement ? (
                      <p className="text-[11px] leading-relaxed">
                        {doc.cert_requirement}
                      </p>
                    ) : (
                      <Empty />
                    )}
                  </td>

                  {/* DICTAMEN JURÍDICO DE LA NOTARÍA */}
                  <td className={`${cellBase} text-gray-700`}>
                    {isTracking && doc ? (
                      <>
                        <label className="sr-only" htmlFor={`legal-${doc.id}`}>
                          Dictamen jurídico de la notaría
                        </label>
                        <textarea
                          id={`legal-${doc.id}`}
                          rows={2}
                          value={trackingDraft.notary_legal_opinion ?? ""}
                          onChange={(e) =>
                            setTrackingDraft((d) => ({
                              ...d,
                              notary_legal_opinion: e.target.value || null,
                            }))
                          }
                          className="w-full resize-none rounded-md border border-emerald-200 px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-emerald-200"
                        />
                      </>
                    ) : (
                      <div className="space-y-1">
                        {doc?.notary_legal_opinion ? (
                          <p className="text-[11px] leading-relaxed">
                            {doc.notary_legal_opinion}
                          </p>
                        ) : (
                          <Empty />
                        )}
                        {canEditTracking && doc && (
                          <button
                            type="button"
                            onClick={() => startTracking(doc)}
                            aria-label={`Editar certificados recabados de ${docType.name}`}
                            className="flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 transition-all hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                          >
                            <Pencil className="h-3 w-3" />
                            Editar
                          </button>
                        )}
                      </div>
                    )}
                  </td>

                  {/* EMISIÓN DE CERTIFICADO */}
                  <td className={cellBase}>{renderEmision(state)}</td>

                  {/* NOMBRE DEL DICTAMINADOR */}
                  <td className={cellBase}>{renderDictaminador(doc, state)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Right-edge fade: the only hint that twelve columns do not fit. */}
      {showRightFade && (
        <div
          aria-hidden="true"
          data-testid="expediente-table-right-fade"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-white to-transparent"
        />
      )}
    </div>
  );
}
