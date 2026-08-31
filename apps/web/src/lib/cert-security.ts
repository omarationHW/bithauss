/**
 * BRC certificate security engine
 *
 * Mirrors the 13 security layers described in the designer's master HTML:
 *   - A1: SHA-256 fingerprint of full document content
 *   - A4: Luhn-modified checksum (alphanumeric)
 *   - E1: deterministic geometric variations per folio
 *   - F1: steganographic watermark from seeded RNG
 *   - F2: zero-width binary marks embedded in critical fields
 *
 * SECURITY — what the QR is and is not
 * ------------------------------------
 * This file used to build the QR as `bithauss.com/verify?p=<base64 payload>`
 * with `sig: "[PENDIENTE-FIRMA-PKI]"` inside. Two problems, both fatal:
 *
 *   1. The payload was self-asserted and UNSIGNED, so anyone could base64 a
 *      JSON of their own and print a QR that "verified" a BRC that was never
 *      issued.
 *   2. `/verify?p=` does not exist. The real endpoint is
 *      `apps/web/src/app/api/verify/[id]/route.ts`, keyed by certificate id,
 *      and the human-readable page is `/certificado/<id>`. A printed QR
 *      pointed nowhere.
 *
 * The QR now carries only a POINTER to the authoritative destination: nothing
 * in it is trusted, verification is a server lookup against
 * `brc_certificates`. For cases where a payload really must travel inside a
 * code (offline validation, future PKI), `signPayload` /
 * `verifyPayloadSignature` below implement HMAC-SHA256 over a canonical
 * serialisation with a constant-time comparison, and REQUIRE an explicit
 * server-side secret — there is deliberately no hardcoded fallback.
 *
 * Path to real PKI: replace the HMAC with an asymmetric signature (Ed25519 /
 * ECDSA P-256) produced by a server-held private key, publish the public key
 * at a well-known URL and add `kid` to the payload so keys can be rotated.
 * The payload shape below is already the one to sign; only the primitive and
 * the key material change.
 */

export interface CertData {
  serie: string;
  folio: string;
  direccion: string;
  escritura: string;
  folioReal: string;
  supTerreno: string;
  supConstruida: string;
  lugar: string;
  dia: string;
  mes: string;
  anio: string;
  numCert: string;
}

export interface SecurityArtifacts {
  hash: string;
  checksum: number;
  timestamp: string;
  seed: number;
  payload: SignablePayload;
  /**
   * What to encode in the QR: the authoritative verification URL, or `null`
   * when the caller did not supply one (the caller then falls back to its own
   * link). It is NEVER a self-asserted payload — see the note at the top.
   */
  encodedPayload: string | null;
}

export interface SignablePayload {
  iss: string;
  typ: string;
  ver: string;
  folio: string;
  serie: string;
  hash: string;
  iat: string;
  exp: string;
  /** Authoritative verification URL, resolved server-side. */
  verify: string;
}

/** Web-Crypto-backed SHA-256 returning hex string. */
export async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Modified Luhn over alphanumerics (A=10..Z=35), returns single check digit 0-9. */
export function luhnChecksum(input: string): number {
  const digits = String(input)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .split("")
    .map((c) => (/\d/.test(c) ? parseInt(c, 10) : c.charCodeAt(0) - 65 + 10));
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = digits[i]!;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return (10 - (sum % 10)) % 10;
}

/** Mulberry32 PRNG returning a function () => [0,1). */
export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** First 32 bits of a hex hash as integer seed (>=1). */
export function seedFromHash(hash: string): number {
  return parseInt(hash.slice(0, 8), 16) || 1;
}

/** Zero-width encoding: '0' -> ZWSP (U+200B), '1' -> ZWNJ (U+200C), trailing BOM. */
export function encodeFolioToZeroWidth(folio: string): string {
  let bits = "";
  for (let i = 0; i < folio.length; i++) {
    bits += folio.charCodeAt(i).toString(2).padStart(8, "0");
  }
  return bits
    .split("")
    .map((b) => (b === "0" ? "​" : "‌"))
    .join("") + "﻿";
}

/** Build the SVG markup for the steganographic watermark (60 deterministic dots). */
export function buildStegoWatermarkSvg(seed: number): string {
  const rng = seededRandom(seed);
  const dots: string[] = [];
  for (let i = 0; i < 60; i++) {
    const x = (rng() * 100).toFixed(2);
    const y = (rng() * 100).toFixed(2);
    const r = (0.15 + rng() * 0.25).toFixed(2);
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="#1B2A4A"/>`);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:100%">${dots.join("")}</svg>`;
}

/**
 * Build the payload describing the certificate.
 *
 * Note what is gone: the `sig: "[PENDIENTE-FIRMA-PKI]"` field. A placeholder
 * where a signature belongs is worse than no field at all — it reads as
 * "signed" to anyone glancing at the JSON. Sign it with `signPayload` when a
 * signature is actually required.
 */
export function buildSignablePayload(
  data: CertData,
  hash: string,
  checksum: number,
  timestamp: string,
  verifyUrl?: string,
): SignablePayload {
  return {
    iss: "bithauss.brc",
    typ: "CERT-BRC",
    ver: "1.0",
    folio: `${data.folio}-${checksum}`,
    serie: data.serie,
    hash: hash.slice(0, 32),
    iat: timestamp,
    exp: "90d",
    verify: verifyUrl ?? "",
  };
}

/* ------------------------------------------------------------------ */
/*  Signing                                                            */
/* ------------------------------------------------------------------ */

/**
 * Deterministic serialisation (sorted keys, recursive) so a payload always
 * signs to the same bytes. Mirrors `canonical()` in the verification route.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  const obj = value as Record<string, unknown>;
  return (
    "{" +
    Object.keys(obj)
      .sort()
      .map((k) => JSON.stringify(k) + ":" + canonicalJson(obj[k]))
      .join(",") +
    "}"
  );
}

/**
 * HMAC-SHA256 over the canonical payload, hex-encoded.
 *
 * The secret MUST come from the server environment (BRC_VERIFY_SECRET). There
 * is no default on purpose: a hardcoded fallback is the same as no signature
 * at all, because the "secret" ships in the bundle.
 */
export async function signPayload(
  payload: unknown,
  secret: string,
): Promise<string> {
  if (!secret || secret.trim().length === 0) {
    throw new Error(
      "Falta el secreto de firma del certificado (BRC_VERIFY_SECRET).",
    );
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(canonicalJson(payload)),
  );
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Constant-time comparison of two hex strings.
 *
 * A plain `===` on a signature leaks, byte by byte, how much of a forged
 * signature was right — enough to reconstruct it with repeated requests.
 */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** True when `signature` is a valid HMAC of `payload` under `secret`. */
export async function verifyPayloadSignature(
  payload: unknown,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expected = await signPayload(payload, secret);
  return timingSafeEqualHex(expected, signature);
}

/** Base64-url encode (no padding). */
export function base64UrlEncode(input: string): string {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Destination for the printed QR: the certificate's public page, which reads
 * from `brc_certificates` through `/api/verify/<id>`. Keyed by the
 * certificate id — the folio is not a route anywhere.
 */
export function buildVerificationUrl(origin: string, certificateId: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}/certificado/${certificateId}`;
}

export interface ComputeSecurityOptions {
  /**
   * Authoritative verification URL (see `buildVerificationUrl`). Omit it and
   * `encodedPayload` comes back null so the caller falls back to its own link
   * rather than encoding an unverifiable blob.
   */
  verifyUrl?: string;
}

/** Full security engine: returns every derived artifact for the certificate. */
export async function computeSecurity(
  data: CertData,
  options: ComputeSecurityOptions = {},
): Promise<SecurityArtifacts> {
  const checksum = luhnChecksum(data.folio + data.serie);
  const fullContent = JSON.stringify(data) + "|" + new Date().toDateString();
  const hash = await sha256(fullContent);
  const timestamp = new Date().toISOString();
  const seed = seedFromHash(hash);
  const payload = buildSignablePayload(
    data,
    hash,
    checksum,
    timestamp,
    options.verifyUrl,
  );
  return {
    hash,
    checksum,
    timestamp,
    seed,
    payload,
    encodedPayload: options.verifyUrl ?? null,
  };
}
