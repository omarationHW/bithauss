/**
 * Which BRC documents a given property actually has to provide.
 *
 * `brc_document_types.is_required` is the base catalogue: what every listing
 * needs. Some documents only apply to certain properties, so the flag alone is
 * not enough — the land-use certificate, for instance, used to be demanded
 * from every owner even though it only matters when selling a house zoned for
 * commercial use or an office.
 *
 * Keeping the rules here (instead of inline in the form) means the request
 * screen, the reviewer's checklist and any future API validation all agree on
 * what "missing document" means.
 */

/** Document slugs that carry a conditional rule. */
export const USO_DE_SUELO_DOC = "Constancia de Uso de Suelo autorizado del Inmueble";

/** Property types for which the land-use certificate is meaningful. */
const USO_DE_SUELO_TYPES = ["CASA_USO_SUELO", "OFICINA"] as const;

/** Operations that involve transferring ownership. */
const SALE_OPERATIONS = ["VENTA", "VENTA_RENTA"] as const;

export interface PropertyForBrc {
  type: string | null;
  operation: string | null;
}

/**
 * True when the land-use certificate must be uploaded: a sale (or sale+rent)
 * of a house with commercial zoning, or of an office.
 */
export function requiresUsoDeSuelo(property: PropertyForBrc): boolean {
  const type = (property.type ?? "").toUpperCase();
  const operation = (property.operation ?? "").toUpperCase();
  return (
    (USO_DE_SUELO_TYPES as readonly string[]).includes(type) &&
    (SALE_OPERATIONS as readonly string[]).includes(operation)
  );
}

export interface BrcDocumentLike {
  name: string;
  is_required: boolean;
}

/**
 * Effective requirement for one document against one property. Documents
 * without a conditional rule fall back to the catalogue flag.
 */
export function isDocumentRequired(
  doc: BrcDocumentLike,
  property: PropertyForBrc,
): boolean {
  if (doc.name === USO_DE_SUELO_DOC) return requiresUsoDeSuelo(property);
  return doc.is_required;
}
