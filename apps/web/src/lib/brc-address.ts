/* ------------------------------------------------------------------ */
/*  Dirección del inmueble exigida para solicitar el BRC               */
/*                                                                     */
/*  Publicar no exige dirección; certificar sí. Estas reglas son las   */
/*  mismas que aplica el trigger de la migración 040 (la base es la    */
/*  que manda), más la coherencia contra el catálogo SEPOMEX, que solo */
/*  puede revisarse aquí porque el catálogo vive en el servidor web.   */
/* ------------------------------------------------------------------ */

export interface StreetAddress {
  street: string;
  exterior_number: string;
  interior_number: string;
}

export interface PropertyAddress {
  street: string | null;
  exterior_number: string | null;
  interior_number?: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
}

/** The SEPOMEX record for one postal code, as /api/postal/[cp] returns it. */
export interface PostalCatalogRecord {
  estado: string;
  municipio: string;
  ciudad: string;
  colonias: string[];
}

/**
 * The single-line address the rest of the app keeps displaying
 * (`properties.address_line`): "Av. Reforma 222 Int. 5".
 */
export function composeAddressLine(a: StreetAddress): string {
  const street = a.street.trim();
  const ext = a.exterior_number.trim();
  const int = a.interior_number.trim();
  return [street, ext, int ? `Int. ${int}` : ""].filter(Boolean).join(" ");
}

/** Spanish labels of the fields still missing, in form order. Empty = complete. */
export function missingBrcAddressFields(p: PropertyAddress): string[] {
  const blank = (v: string | null | undefined) => !v || v.trim() === "";
  const missing: string[] = [];
  if (blank(p.state)) missing.push("Estado");
  if (blank(p.city)) missing.push("Ciudad / Alcaldía");
  if (blank(p.neighborhood)) missing.push("Colonia");
  if (!/^\d{5}$/.test(p.zip_code ?? "")) missing.push("Código postal");
  if (blank(p.street)) missing.push("Calle");
  if (blank(p.exterior_number)) missing.push("Número exterior");
  return missing;
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export interface CatalogCheck {
  /** Blocking problems: the address contradicts the SEPOMEX catalog. */
  errors: string[];
  /** Worth showing, not blocking (a colonia SEPOMEX doesn't list yet). */
  warnings: string[];
}

/**
 * Cross-checks the captured address against the SEPOMEX record of its
 * postal code. `record === null` means the C.P. does not exist.
 *
 * A colonia missing from the C.P. list only warns: SEPOMEX lags behind new
 * developments and the form already lets the owner type one ("Otra").
 */
export function checkAddressAgainstCatalog(
  p: PropertyAddress,
  record: PostalCatalogRecord | null,
): CatalogCheck {
  const errors: string[] = [];
  const warnings: string[] = [];
  const cp = p.zip_code ?? "";

  if (!record) {
    errors.push(`El código postal ${cp} no existe en el catálogo de SEPOMEX.`);
    return { errors, warnings };
  }

  if (p.state && normalize(p.state) !== normalize(record.estado)) {
    errors.push(
      `El código postal ${cp} pertenece a ${record.estado}, no a ${p.state}.`,
    );
  }

  // The form stores the municipio (alcaldía) in `city`. SEPOMEX's coarser
  // `ciudad` ("Ciudad de México") is not enough to certify: the alcaldía is
  // what gets checked against the escritura.
  const city = normalize(p.city ?? "");
  if (city !== "" && city !== normalize(record.municipio)) {
    errors.push(
      city === normalize(record.ciudad)
        ? `Indica la alcaldía o municipio (${record.municipio}), no solo «${p.city}».`
        : `El código postal ${cp} pertenece a ${record.municipio}, no a ${p.city}.`,
    );
  }

  const colonia = normalize(p.neighborhood ?? "");
  if (colonia !== "" && !record.colonias.some((c) => normalize(c) === colonia)) {
    warnings.push(
      `La colonia «${p.neighborhood}» no aparece en el código postal ${cp}. La notaría la revisará contra la escritura.`,
    );
  }

  return { errors, warnings };
}

/**
 * Fetches the SEPOMEX record for a C.P. Distinguishes "does not exist"
 * (`record: null`) from "could not ask" (`unavailable: true`), so an outage
 * never blocks a request — the DB trigger still guarantees completeness.
 */
export async function lookupPostalForBrc(
  cp: string,
): Promise<{ record: PostalCatalogRecord | null; unavailable: boolean }> {
  try {
    const res = await fetch(`/api/postal/${cp}`);
    if (res.status === 404) return { record: null, unavailable: false };
    if (!res.ok) return { record: null, unavailable: true };
    const data = (await res.json()) as PostalCatalogRecord;
    if (!data || !Array.isArray(data.colonias)) {
      return { record: null, unavailable: true };
    }
    return { record: data, unavailable: false };
  } catch {
    return { record: null, unavailable: true };
  }
}
