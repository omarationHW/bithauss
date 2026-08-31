/**
 * Which BRC documents a property actually has to provide.
 *
 * This mirrors `apps/web/src/lib/brc-documents.ts`. The rule cannot simply be
 * imported: the web app is a Next.js package and the API must not depend on
 * it. It is duplicated deliberately and kept minimal — if the two ever drift,
 * the API is the one that decides, because it is the one that gates issuance.
 *
 * Why it matters: `brc_document_types.is_required` alone used to gate
 * certification, so the land-use certificate was demanded from every owner
 * even though it only applies to the sale of a commercially zoned house or an
 * office. Expedientes could never be certified.
 */

export const USO_DE_SUELO_DOC =
  'Constancia de Uso de Suelo autorizado del Inmueble';

const USO_DE_SUELO_TYPES = ['CASA_USO_SUELO', 'OFICINA'];
const SALE_OPERATIONS = ['VENTA', 'VENTA_RENTA'];

export interface PropertyForBrc {
  type: string | null;
  operation: string | null;
}

export function requiresUsoDeSuelo(property: PropertyForBrc): boolean {
  const type = (property.type ?? '').toUpperCase();
  const operation = (property.operation ?? '').toUpperCase();
  return (
    USO_DE_SUELO_TYPES.includes(type) && SALE_OPERATIONS.includes(operation)
  );
}

export interface BrcDocumentLike {
  name: string;
  is_required: boolean;
}

export function isDocumentRequired(
  doc: BrcDocumentLike,
  property: PropertyForBrc,
): boolean {
  if (doc.name === USO_DE_SUELO_DOC) return requiresUsoDeSuelo(property);
  return doc.is_required;
}

/** A document counts as cleared under either spelling used in the schema. */
export function isDocumentValidated(status: string | null | undefined): boolean {
  return status === 'VALIDADO' || status === 'APROBADO';
}

export interface DocumentRequirementRow {
  name: string;
  is_required: boolean;
  status: string | null;
}

/**
 * Names of the required documents still missing or not validated.
 *
 * Callers must pass ONE row per catalogue entry, carrying the status of its
 * most recent upload (`null` when nothing was uploaded). Judging per
 * requirement rather than per uploaded row matters twice over: a correction
 * creates a new row, so an old RECHAZADO would otherwise block the expediente
 * forever, and a required type that was never uploaded would block nothing at
 * all because it has no row to inspect.
 */
export function missingRequiredDocuments(
  rows: DocumentRequirementRow[],
  property: PropertyForBrc,
): string[] {
  return rows
    .filter((row) =>
      isDocumentRequired(
        { name: row.name, is_required: row.is_required },
        property,
      ),
    )
    .filter((row) => !isDocumentValidated(row.status))
    .map((row) => row.name);
}

/**
 * True when every required document is cleared. An expediente with no
 * required documents at all is misconfigured, not complete — certifying it
 * would mean certifying nothing.
 */
export function areRequiredDocumentsValidated(
  rows: DocumentRequirementRow[],
  property: PropertyForBrc,
): boolean {
  const required = rows.filter((row) =>
    isDocumentRequired({ name: row.name, is_required: row.is_required }, property),
  );
  if (required.length === 0) return false;
  return required.every((row) => isDocumentValidated(row.status));
}
