/**
 * Signing key for the public BRC verification endpoint.
 *
 * BH-02: this used to fall back to a literal secret checked into the
 * repository. An HMAC whose key is public is not a signature — anyone could
 * mint a `{"valid": true}` response that verified. There is no safe default
 * for a signing key, so the caller refuses to answer without one instead of
 * pretending to be signed.
 *
 * It lives here rather than in the route module because a Next.js route file
 * may only export request handlers and a fixed set of config fields; exporting
 * a helper from it fails the production build (`tsc --noEmit` does not catch
 * this — only `next build` does).
 *
 * Resolved per call (not at module load) so a missing variable produces a
 * clear 500 on the endpoint rather than an opaque failure while Next is
 * collecting page data at build time.
 */
export function requireSigningKey(): string {
  const key = process.env.BRC_VERIFY_SECRET;
  if (!key || key.trim().length === 0) {
    throw new Error(
      "BRC_VERIFY_SECRET no está configurado. La verificación pública del certificado no puede firmarse sin él (ver docs/SECURITY.md, 4.1).",
    );
  }
  return key;
}
