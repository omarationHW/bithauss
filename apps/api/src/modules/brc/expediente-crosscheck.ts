import type { SupabaseClient } from '@supabase/supabase-js';
import {
  addressesMatch,
  coerceText,
  crossCheckEscritura,
  namesMatch,
  normalizeStr,
  spanishNumberWords,
  type EscrituraCheck,
  type EscrituraCrossCheckInput,
  type EscrituraCrossCheckResult,
} from '../ocr/ocr.service';

/* ------------------------------------------------------------------ */
/*  Validación cruzada del expediente real                             */
/*                                                                     */
/*  The 18 rules of crossCheckEscritura used to run only on the admin  */
/*  test page. Here they run over the documents stored in the          */
/*  expediente (OCR data, with the notary's corrections on top) plus   */
/*  checks of the address the owner captured for the property against */
/*  the escritura and the other official documents.                   */
/* ------------------------------------------------------------------ */

type Data = Record<string, unknown>;

export interface ExpedienteDoc {
  type_name: string;
  status: string | null;
  data: Data;
}

export interface PropertyAddressRow {
  street: string | null;
  exterior_number: string | null;
  neighborhood: string | null;
  zip_code: string | null;
  city: string | null;
  state: string | null;
}

/** Payload key of each document type, by the name the catalog uses. */
const SLOTS: Array<{ key: keyof EscrituraCrossCheckInput | 'comprobante' | 'usoSuelo'; re: RegExp }> = [
  { key: 'escrituraAntecedente', re: /antecedente/i },
  { key: 'escritura', re: /^escritura de propiedad/i },
  { key: 'identificacion', re: /^identificaci[oó]n/i },
  { key: 'actaMatrimonio', re: /^acta de matrimonio/i },
  { key: 'folioReal', re: /^folio real/i },
  { key: 'certificadoLibertadGravamen', re: /libertad de gravamen/i },
  { key: 'boletaPredial', re: /boleta predial/i },
  { key: 'boletaAgua', re: /boleta de agua/i },
  { key: 'comprobante', re: /^comprobante de domicilio/i },
  { key: 'usoSuelo', re: /uso de suelo/i },
];

/**
 * Picks one document per slot. `docs` must come newest first, so a document
 * re-uploaded after a rejection wins over the rejected one; rejected rows are
 * ignored altogether.
 */
export function pickDocuments(docs: ExpedienteDoc[]): Partial<Record<(typeof SLOTS)[number]['key'], Data>> {
  const out: Partial<Record<(typeof SLOTS)[number]['key'], Data>> = {};
  const ids: Data[] = [];
  for (const doc of docs) {
    if (doc.status === 'RECHAZADO') continue;
    const slot = SLOTS.find((s) => s.re.test(doc.type_name));
    if (slot?.key === 'identificacion') ids.push(doc.data);
    if (slot && !out[slot.key]) out[slot.key] = doc.data;
  }
  // One ID per co-owner: compare against the owner the escritura names, not
  // whichever ID happened to be uploaded last.
  const owner = out.escritura?.nombreComprador;
  const ownersId = owner ? ids.find((id) => namesMatch(owner, id.nombreCompleto)) : undefined;
  if (ownersId) out.identificacion = ownersId;
  return out;
}

const pass = (rule: string, label: string, message: string): EscrituraCheck => ({ rule, label, status: 'pass', message });
const fail = (rule: string, label: string, message: string): EscrituraCheck => ({ rule, label, status: 'fail', message });
const warn = (rule: string, label: string, message: string): EscrituraCheck => ({ rule, label, status: 'warn', message });
const skip = (rule: string, label: string, message: string): EscrituraCheck => ({ rule, label, status: 'skip', message });

function tokens(text: unknown): string[] {
  return normalizeStr(text).split(' ').filter(Boolean);
}

/** "Alcaldía Cuauhtémoc" / "Delegación Cuauhtémoc" / "Municipio de Zapopan" → "cuauhtemoc" / "zapopan". */
function bareMunicipio(value: unknown): string {
  return normalizeStr(value)
    .replace(/^(alcaldia|delegacion|municipio)( de)?\s+/, '')
    .trim();
}

/** Checks of the captured property address against the official documents. */
export function checkPropertyAddress(
  property: PropertyAddressRow | null,
  picked: ReturnType<typeof pickDocuments>,
): EscrituraCheck[] {
  const checks: EscrituraCheck[] = [];
  const escritura = picked.escritura ?? {};
  const deedAddress = coerceText(escritura.direccionInmueble);
  const deedPlace = `${deedAddress} ${coerceText(escritura.ciudadInmueble)}`;

  if (!property) return checks;
  const captured = [property.street, property.exterior_number, property.neighborhood]
    .filter(Boolean)
    .join(' ');

  /* A. Dirección capturada = escritura */
  const A = ['direccion_capturada_escritura', 'La dirección capturada del inmueble coincide con la escritura'] as const;
  checks.push(
    // Listings from before migration 040 only have colonia: comparing that
    // alone against a full deed address always "fails". Requesting the BRC
    // now requires the street, so this only affects older expedientes.
    !property.street?.trim() || !deedAddress
      ? skip(...A, 'Falta la calle capturada del inmueble o la dirección de la escritura.')
      : addressesMatch(captured, deedAddress)
        ? pass(...A, 'La dirección capturada coincide con la escritura.')
        : fail(...A, `Capturada: "${captured}" ≠ Escritura: "${deedAddress}".`),
  );

  /* B. Número exterior presente en la escritura */
  const B = ['numero_exterior_escritura', 'El número exterior aparece en la dirección de la escritura'] as const;
  const ext = normalizeStr(property.exterior_number).replace(/\s+/g, '');
  checks.push(
    !ext || /^s?n$/.test(ext) || !deedAddress
      ? skip(...B, 'Sin número exterior que comparar (o la escritura no trae dirección).')
      : tokens(deedAddress).includes(ext) ||
          // Escrituras write numbers in words: "número treinta y seis".
          (/^\d{1,4}$/.test(ext) && normalizeStr(deedAddress).includes(spanishNumberWords(Number(ext))))
        ? pass(...B, `El número exterior ${property.exterior_number} aparece en la escritura.`)
        : fail(...B, `El número exterior ${property.exterior_number} no aparece en "${deedAddress}".`),
  );

  /* C. Código postal = el de la escritura (si la escritura lo trae) */
  const C = ['codigo_postal_escritura', 'El código postal coincide con el de la escritura'] as const;
  const deedCps: string[] = deedAddress.match(/\b\d{5}\b/g) ?? [];
  checks.push(
    !property.zip_code || deedCps.length === 0
      ? skip(...C, 'La escritura no trae código postal legible.')
      : deedCps.includes(property.zip_code)
        ? pass(...C, `C.P. ${property.zip_code} coincide.`)
        : fail(...C, `Capturado C.P. ${property.zip_code}; la escritura dice ${deedCps.join(', ')}.`),
  );

  /* D. Alcaldía / municipio mencionado en la escritura */
  const D = ['alcaldia_escritura', 'La alcaldía o municipio coincide con la escritura'] as const;
  const municipio = bareMunicipio(property.city);
  checks.push(
    !municipio || !deedPlace.trim()
      ? skip(...D, 'Falta la alcaldía capturada o la ubicación de la escritura.')
      : normalizeStr(deedPlace).includes(municipio)
        ? pass(...D, `${property.city} aparece en la escritura.`)
        : warn(...D, `No se encontró "${property.city}" en la ubicación de la escritura; revísala a mano.`),
  );

  /* E/F. Comprobante de domicilio y uso de suelo = escritura */
  const others: Array<[string, string, Data | undefined, string]> = [
    ['domicilio_comprobante', 'El comprobante de domicilio es del mismo inmueble', picked.comprobante, 'direccion'],
    ['domicilio_uso_suelo', 'La constancia de uso de suelo es del mismo inmueble', picked.usoSuelo, 'direccionInmueble'],
  ];
  for (const [rule, label, data, field] of others) {
    if (!data) continue;
    const addr = coerceText(data[field]);
    checks.push(
      !addr || !deedAddress
        ? skip(rule, label, 'Falta la dirección en el documento o en la escritura.')
        : addressesMatch(addr, deedAddress)
          ? pass(rule, label, 'La dirección coincide con la escritura.')
          : fail(rule, label, `Documento: "${addr}" ≠ Escritura: "${deedAddress}".`),
    );
  }

  return checks;
}

function summarize(checks: EscrituraCheck[]): EscrituraCrossCheckResult['summary'] {
  return checks.reduce(
    (acc, c) => {
      acc[c.status]++;
      return acc;
    },
    { pass: 0, fail: 0, warn: 0, skip: 0 },
  );
}

/**
 * Full cross-check of an expediente, or null while there is no escritura to
 * compare against (nothing to block on yet).
 */
export function crossCheckExpediente(
  docs: ExpedienteDoc[],
  property: PropertyAddressRow | null,
): EscrituraCrossCheckResult | null {
  const picked = pickDocuments(docs);
  if (!picked.escritura) return null;
  const base = crossCheckEscritura({
    escritura: picked.escritura,
    identificacion: picked.identificacion ?? null,
    actaMatrimonio: picked.actaMatrimonio ?? null,
    folioReal: picked.folioReal ?? null,
    certificadoLibertadGravamen: picked.certificadoLibertadGravamen ?? null,
    boletaPredial: picked.boletaPredial ?? null,
    boletaAgua: picked.boletaAgua ?? null,
    escrituraAntecedente: picked.escrituraAntecedente ?? null,
  } as EscrituraCrossCheckInput);
  const checks = [...base.checks, ...checkPropertyAddress(property, picked)];
  return { checks, summary: summarize(checks) };
}

/** Loads the expediente's documents and property and runs the cross-check. */
export async function loadExpedienteCrossCheck(
  supabase: SupabaseClient,
  expedienteId: string,
  propertyId: string,
): Promise<EscrituraCrossCheckResult | null> {
  const [{ data: docs }, { data: property }] = await Promise.all([
    supabase
      .from('brc_documents')
      .select('status, ocr_extracted_data, ocr_corrected_data, created_at, brc_document_types ( name )')
      .eq('expediente_id', expedienteId)
      .order('created_at', { ascending: false }),
    supabase
      .from('properties')
      .select('street, exterior_number, neighborhood, zip_code, city, state')
      .eq('id', propertyId)
      .maybeSingle(),
  ]);

  type Row = {
    status: string | null;
    ocr_extracted_data: Data | null;
    ocr_corrected_data: Data | null;
    brc_document_types: { name: string } | { name: string }[] | null;
  };
  const rows = (Array.isArray(docs) ? docs : []) as Row[];
  const mapped: ExpedienteDoc[] = rows.map((d) => {
    const t = d.brc_document_types;
    return {
      type_name: (Array.isArray(t) ? t[0]?.name : t?.name) ?? '',
      status: d.status,
      data: { ...(d.ocr_extracted_data ?? {}), ...(d.ocr_corrected_data ?? {}) },
    };
  });
  return crossCheckExpediente(mapped, (property as PropertyAddressRow | null) ?? null);
}
