/**
 * The notarial module's state machine, in one place.
 *
 * The BRC used to be issued in a single step: the notary uploaded a PDF and
 * the property came out CERTIFICADO. That merged two very different acts.
 *
 *   Step A — the NOTARY issues the *Certificado Notarial*: a legal statement
 *            that the expediente holds up. It is the basis for the BRC.
 *   Step B — BITHAUSS (admin / BRC operator) issues the *BRC* from it,
 *            tokenises it and stamps the listing. A notary must never be able
 *            to do this: the whole value of the seal is that the platform,
 *            not the party that reviewed the file, grants it.
 *
 * Both gates are pure functions here so the expediente screen, the admin
 * screen and the API tests all agree on who may do what, and so the reasons a
 * button is disabled can be shown instead of guessed.
 */

import { isDocumentRequired, type PropertyForBrc } from "./brc-documents";

/* ------------------------------------------------------------------ */
/*  Statuses                                                           */
/* ------------------------------------------------------------------ */

export const BRC_STATUS = {
  BORRADOR: "BORRADOR",
  NO_SOLICITADO: "NO_SOLICITADO",
  EN_REVISION: "EN_REVISION",
  DOCUMENTACION_PENDIENTE: "DOCUMENTACION_PENDIENTE",
  VALIDACION_NOTARIAL: "VALIDACION_NOTARIAL",
  PENDIENTE_EMISION_BRC: "PENDIENTE_EMISION_BRC",
  CERTIFICADO: "CERTIFICADO",
  RECHAZADO: "RECHAZADO",
} as const;

export type BrcExpedienteStatus =
  (typeof BRC_STATUS)[keyof typeof BRC_STATUS];

/** Spanish copy for every expediente state. */
export const BRC_STATUS_LABELS: Record<string, string> = {
  BORRADOR: "Borrador",
  NO_SOLICITADO: "No solicitado",
  EN_REVISION: "En revisión",
  DOCUMENTACION_PENDIENTE: "Documentación pendiente",
  VALIDACION_NOTARIAL: "Validación notarial",
  PENDIENTE_EMISION_BRC: "Certificado notarial emitido · pendiente de BRC",
  CERTIFICADO: "Certificado BRC emitido",
  RECHAZADO: "Rechazado",
};

/** Compact label for tight spots (badges inside tables and cards). */
export const BRC_STATUS_SHORT_LABELS: Record<string, string> = {
  ...BRC_STATUS_LABELS,
  PENDIENTE_EMISION_BRC: "Pendiente de BRC",
  CERTIFICADO: "Certificado",
};

export const BRC_STATUS_BADGE_STYLES: Record<string, string> = {
  BORRADOR: "bg-gray-50 text-gray-500 border border-gray-200",
  EN_REVISION: "bg-blue-50 text-blue-600 border border-blue-200",
  DOCUMENTACION_PENDIENTE: "bg-amber-50 text-amber-600 border border-amber-200",
  VALIDACION_NOTARIAL: "bg-purple-50 text-purple-600 border border-purple-200",
  PENDIENTE_EMISION_BRC: "bg-indigo-50 text-indigo-600 border border-indigo-200",
  CERTIFICADO: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  RECHAZADO: "bg-red-50 text-red-600 border border-red-200",
};

/** The happy path, in order, for the progress stepper. */
export const BRC_STATUS_STEPS = [
  { key: BRC_STATUS.EN_REVISION, label: "En revisión" },
  { key: BRC_STATUS.DOCUMENTACION_PENDIENTE, label: "Documentación" },
  { key: BRC_STATUS.VALIDACION_NOTARIAL, label: "Validación" },
  { key: BRC_STATUS.PENDIENTE_EMISION_BRC, label: "Certificado notarial" },
  { key: BRC_STATUS.CERTIFICADO, label: "BRC emitido" },
] as const;

/** Nothing moves once the expediente reached one of these. */
export function isTerminalBrcStatus(status: string): boolean {
  return status === BRC_STATUS.CERTIFICADO || status === BRC_STATUS.RECHAZADO;
}

/**
 * Every state a certification can be in while it is under way.
 *
 * Surfaces that used to test `status === "EN_REVISION"` were written when the
 * flow had one intermediate state. It now has four — DOCUMENTACION_PENDIENTE,
 * VALIDACION_NOTARIAL and, since migración 024, PENDIENTE_EMISION_BRC — and
 * an equality check against one of them silently renders NOTHING for the other
 * three: the owner sees no badge and no explanation between submitting the
 * expediente and the BRC being issued. Ask this instead.
 */
export const BRC_IN_PROGRESS_STATUSES: readonly string[] = [
  BRC_STATUS.EN_REVISION,
  BRC_STATUS.DOCUMENTACION_PENDIENTE,
  BRC_STATUS.VALIDACION_NOTARIAL,
  BRC_STATUS.PENDIENTE_EMISION_BRC,
];

/** True while the certification is under way (submitted, not yet resolved). */
export function isBrcInProgress(status: string | null | undefined): boolean {
  return !!status && BRC_IN_PROGRESS_STATUSES.includes(status);
}

/**
 * Every state `brc_expedientes.status` / `properties.brc_status` can hold.
 * Mirrors the Postgres `brc_status` enum: 001 (six values) + 018 (BORRADOR) +
 * 024 (PENDIENTE_EMISION_BRC). Anything rendering a state must cover this
 * list — a `Record` keyed on a shorter list falls through to a silent blank.
 */
export const ALL_BRC_STATUSES: readonly BrcExpedienteStatus[] = [
  BRC_STATUS.BORRADOR,
  BRC_STATUS.NO_SOLICITADO,
  BRC_STATUS.EN_REVISION,
  BRC_STATUS.DOCUMENTACION_PENDIENTE,
  BRC_STATUS.VALIDACION_NOTARIAL,
  BRC_STATUS.PENDIENTE_EMISION_BRC,
  BRC_STATUS.CERTIFICADO,
  BRC_STATUS.RECHAZADO,
];

/**
 * Index of the current status in the stepper. -1 for RECHAZADO, which is not
 * a point on the line but a way off it.
 */
export function getBrcProgressStep(status: string): number {
  if (status === BRC_STATUS.RECHAZADO) return -1;
  const idx = BRC_STATUS_STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

/* ------------------------------------------------------------------ */
/*  Roles                                                              */
/* ------------------------------------------------------------------ */

export type BrcRole =
  | "ADMIN"
  | "OPERADOR_BRC"
  | "NOTARIO"
  | "INMOBILIARIA"
  | "BROKER"
  | "VENDEDOR"
  | "COMPRADOR";

/** Roles that act on behalf of BitHauss when issuing the BRC. */
export const BRC_ISSUER_ROLES: readonly string[] = ["ADMIN", "OPERADOR_BRC"];

/* ------------------------------------------------------------------ */
/*  Document gating                                                    */
/* ------------------------------------------------------------------ */

/** A document status counts as cleared under either spelling. */
const VALIDATED_STATUSES = ["VALIDADO", "APROBADO"];

export function isDocumentValidated(status: string | null | undefined): boolean {
  return !!status && VALIDATED_STATUSES.includes(status);
}

/**
 * One requirement of the expediente: the catalogue entry plus the status of
 * its most recent upload (`null` when nothing was uploaded at all).
 */
export interface DocumentReviewRow {
  name: string;
  is_required: boolean;
  status: string | null;
}

/**
 * Names of the required documents still standing between the expediente and
 * the notarial certificate.
 *
 * Judged per requirement, not per uploaded row: a rejected file that was
 * later corrected must not keep blocking, and a required document that was
 * never uploaded must block even though it has no row to inspect.
 */
export function missingRequiredDocuments(
  rows: DocumentReviewRow[],
  property: PropertyForBrc,
): string[] {
  return rows
    .filter((row) =>
      isDocumentRequired({ name: row.name, is_required: row.is_required }, property),
    )
    .filter((row) => !isDocumentValidated(row.status))
    .map((row) => row.name);
}

/**
 * True when every required document is validated. An expediente with no
 * required documents at all is not "complete" — it is misconfigured, and
 * certifying it would mean certifying nothing.
 */
export function areRequiredDocumentsValidated(
  rows: DocumentReviewRow[],
  property: PropertyForBrc,
): boolean {
  const required = rows.filter((row) =>
    isDocumentRequired({ name: row.name, is_required: row.is_required }, property),
  );
  if (required.length === 0) return false;
  return required.every((row) => isDocumentValidated(row.status));
}

/* ------------------------------------------------------------------ */
/*  Permission gates                                                   */
/* ------------------------------------------------------------------ */

export type BrcGateReason =
  | "ROL_NO_AUTORIZADO"
  | "NOTARIO_NO_ASIGNADO"
  | "EXPEDIENTE_CERRADO"
  | "DOCUMENTOS_PENDIENTES"
  | "CERTIFICADO_NOTARIAL_FALTANTE"
  | "ESTADO_INVALIDO";

/** Spanish copy for each refusal, ready to render. */
export const BRC_GATE_MESSAGES: Record<BrcGateReason, string> = {
  ROL_NO_AUTORIZADO: "Tu rol no puede realizar esta acción.",
  NOTARIO_NO_ASIGNADO: "No eres el notario asignado a este expediente.",
  EXPEDIENTE_CERRADO: "El expediente ya está cerrado.",
  DOCUMENTOS_PENDIENTES:
    "Faltan documentos obligatorios por validar.",
  CERTIFICADO_NOTARIAL_FALTANTE:
    "Aún no se ha emitido el Certificado Notarial de este expediente.",
  ESTADO_INVALIDO:
    "El expediente no está en un estado que permita esta acción.",
};

export interface BrcGateResult {
  allowed: boolean;
  reason: BrcGateReason | null;
  /** Ready-to-render Spanish explanation; empty when allowed. */
  message: string;
}

function deny(reason: BrcGateReason): BrcGateResult {
  return { allowed: false, reason, message: BRC_GATE_MESSAGES[reason] };
}

const ALLOW: BrcGateResult = { allowed: true, reason: null, message: "" };

export interface NotarialCertificateGateInput {
  role: string | null | undefined;
  userId: string | null | undefined;
  /** `brc_expedientes.assigned_notary_id` */
  assignedNotaryId: string | null | undefined;
  status: string;
  rows: DocumentReviewRow[];
  property: PropertyForBrc;
}

/**
 * Step A: may this user upload the Certificado Notarial?
 *
 * Only the assigned notary (admins keep an override so a stuck expediente can
 * be unblocked), only while the expediente is open, and only once every
 * required document has been validated.
 */
export function canIssueNotarialCertificate(
  input: NotarialCertificateGateInput,
): BrcGateResult {
  const { role, userId, assignedNotaryId, status, rows, property } = input;

  if (role !== "NOTARIO" && role !== "ADMIN") return deny("ROL_NO_AUTORIZADO");
  if (role === "NOTARIO" && (!userId || assignedNotaryId !== userId)) {
    return deny("NOTARIO_NO_ASIGNADO");
  }
  if (isTerminalBrcStatus(status)) return deny("EXPEDIENTE_CERRADO");
  if (!areRequiredDocumentsValidated(rows, property)) {
    return deny("DOCUMENTOS_PENDIENTES");
  }
  return ALLOW;
}

export interface BrcIssuanceGateInput {
  role: string | null | undefined;
  status: string;
  /** Whether a current (non-superseded) Certificado Notarial exists. */
  hasNotarialCertificate: boolean;
}

/**
 * Step B: may this user issue the BRC?
 *
 * BitHauss only. A NOTARIO is explicitly refused even on their own
 * expediente — that separation is the point of the two-step flow.
 */
export function canIssueBrc(input: BrcIssuanceGateInput): BrcGateResult {
  const { role, status, hasNotarialCertificate } = input;

  if (!role || !BRC_ISSUER_ROLES.includes(role)) return deny("ROL_NO_AUTORIZADO");
  if (isTerminalBrcStatus(status)) return deny("EXPEDIENTE_CERRADO");
  if (!hasNotarialCertificate) return deny("CERTIFICADO_NOTARIAL_FALTANTE");
  if (status !== BRC_STATUS.PENDIENTE_EMISION_BRC) return deny("ESTADO_INVALIDO");
  return ALLOW;
}

/* ------------------------------------------------------------------ */
/*  Certificate numbering                                              */
/* ------------------------------------------------------------------ */

/** `BRC-<year>-<6 digits>`, the shape the whole platform expects. */
export const CERTIFICATE_NUMBER_PATTERN = /^BRC-(\d{4})-(\d{6})$/;

export function formatCertificateNumber(year: number, sequence: number): string {
  return `BRC-${year}-${String(sequence).padStart(6, "0")}`;
}

/**
 * Next number after a batch of existing ones, scoped to a year.
 *
 * Sequential and deterministic — the browser used to draw it with
 * `Math.random()`, which could (and eventually would) collide with an issued
 * folio. Numbers from other years and anything that does not match the shape
 * are ignored rather than trusted.
 */
export function nextCertificateNumber(
  existingNumbers: readonly string[],
  year: number = new Date().getFullYear(),
): string {
  let max = 0;
  for (const number of existingNumbers) {
    const match = CERTIFICATE_NUMBER_PATTERN.exec(number ?? "");
    if (!match) continue;
    if (Number(match[1]) !== year) continue;
    max = Math.max(max, Number(match[2]));
  }
  return formatCertificateNumber(year, max + 1);
}

/* ------------------------------------------------------------------ */
/*  Collected certificates (green block of the expediente table)       */
/* ------------------------------------------------------------------ */

export const CERT_RESULTS = ["FAVORABLE", "DESFAVORABLE", "SIN_RESULTADO"] as const;
export type CertResult = (typeof CERT_RESULTS)[number];

export const CERT_RESULT_LABELS: Record<CertResult, string> = {
  FAVORABLE: "Favorable",
  DESFAVORABLE: "Desfavorable",
  SIN_RESULTADO: "Sin resultado",
};

export function isCertResult(value: unknown): value is CertResult {
  return (
    typeof value === "string" && (CERT_RESULTS as readonly string[]).includes(value)
  );
}
