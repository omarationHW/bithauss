/**
 * BRC folio numbering.
 *
 * The number used to be drawn in the BROWSER with `Math.random()` and posted
 * to the API, which is wrong on three counts: it is not sequential, it can
 * collide with an already issued folio (and `brc_certificates.certificate_number`
 * is UNIQUE, so the second issuance would blow up with an opaque database
 * error), and it let the client pick the identifier of a legal document.
 *
 * The number is now derived on the server from what has already been issued,
 * and the caller retries on the unique-violation that a concurrent issuance
 * would cause. Kept pure so both halves are testable without a database.
 */

/** `BRC-<year>-<6 digits>` — the shape the whole platform expects. */
export const CERTIFICATE_NUMBER_PATTERN = /^BRC-(\d{4})-(\d{6})$/;

/** Postgres unique_violation. */
export const UNIQUE_VIOLATION = '23505';

/** How many times to re-derive the number when a concurrent insert wins. */
export const MAX_NUMBER_ATTEMPTS = 5;

export function formatCertificateNumber(year: number, sequence: number): string {
  return `BRC-${year}-${String(sequence).padStart(6, '0')}`;
}

/** Prefix used to narrow the "what has been issued this year" query. */
export function certificateNumberPrefix(year: number): string {
  return `BRC-${year}-`;
}

/**
 * Next folio after the ones already issued in `year`. Numbers from other
 * years and anything that does not match the shape are ignored rather than
 * trusted — a malformed row must not be able to skew the sequence.
 */
export function nextCertificateNumber(
  existingNumbers: readonly (string | null | undefined)[],
  year: number = new Date().getFullYear(),
): string {
  let max = 0;
  for (const number of existingNumbers) {
    const match = CERTIFICATE_NUMBER_PATTERN.exec(number ?? '');
    if (!match) continue;
    if (Number(match[1]) !== year) continue;
    max = Math.max(max, Number(match[2]));
  }
  return formatCertificateNumber(year, max + 1);
}
