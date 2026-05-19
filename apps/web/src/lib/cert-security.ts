/**
 * BRC certificate security engine
 *
 * Mirrors the 13 security layers described in the designer's master HTML:
 *   - A1: SHA-256 fingerprint of full document content
 *   - A4: Luhn-modified checksum (alphanumeric)
 *   - E1: deterministic geometric variations per folio
 *   - F1: steganographic watermark from seeded RNG
 *   - F2: zero-width binary marks embedded in critical fields
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
  encodedPayload: string;
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
  verify: string;
  sig: string;
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

/** Build the signable payload that gets base64-url-encoded into the QR. */
export function buildSignablePayload(
  data: CertData,
  hash: string,
  checksum: number,
  timestamp: string,
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
    verify: `https://bithauss.com/verify/${data.folio}`,
    sig: "[PENDIENTE-FIRMA-PKI]",
  };
}

/** Base64-url encode (no padding). */
export function base64UrlEncode(input: string): string {
  return btoa(input)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Build the URL embedded in the QR with the signed payload. */
export function buildQrUrl(payload: SignablePayload): string {
  const encoded = base64UrlEncode(JSON.stringify(payload));
  return `https://bithauss.com/verify?p=${encoded}`;
}

/** Full security engine: returns every derived artifact for the certificate. */
export async function computeSecurity(data: CertData): Promise<SecurityArtifacts> {
  const checksum = luhnChecksum(data.folio + data.serie);
  const fullContent = JSON.stringify(data) + "|" + new Date().toDateString();
  const hash = await sha256(fullContent);
  const timestamp = new Date().toISOString();
  const seed = seedFromHash(hash);
  const payload = buildSignablePayload(data, hash, checksum, timestamp);
  const encodedPayload = buildQrUrl(payload);
  return { hash, checksum, timestamp, seed, payload, encodedPayload };
}
