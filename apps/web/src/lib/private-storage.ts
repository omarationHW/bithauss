/**
 * Opening files that live in a PRIVATE Supabase Storage bucket.
 *
 * `brc-documents` is private, but the app stored `getPublicUrl(...)` results in
 * `brc_documents.file_url`. Those URLs are just string concatenation — Supabase
 * builds them without checking the bucket — and they 400 for everyone, so the
 * expediente screen showed download links that could not be opened, including
 * for the assigned notary.
 *
 * Rather than migrate every stored URL, we derive the object path back out of
 * it and mint a short-lived signed URL at click time. Access is still decided
 * by the storage RLS policies (migration 019), so a signed URL is only issued
 * to someone who may read the object.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Signed links are opened immediately; a short life is plenty. */
export const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Extracts the object path from a Supabase Storage URL, whether it is a
 * public, signed or authenticated one. Returns null when the URL does not
 * belong to `bucket`.
 */
export function storagePathFromUrl(url: string, bucket: string): string | null {
  if (!url) return null;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
    `/storage/v1/object/authenticated/${bucket}/`,
    `/storage/v1/object/${bucket}/`,
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx !== -1) {
      const path = url.slice(idx + marker.length).split("?")[0] ?? "";
      return path ? decodeURIComponent(path) : null;
    }
  }
  // Already a bare object path.
  return url.startsWith("http") ? null : url;
}

/**
 * Returns a temporary URL for a stored document, or null when the object is
 * missing or the caller is not allowed to read it.
 */
export async function getSignedDocumentUrl(
  supabase: SupabaseClient,
  fileUrl: string,
  bucket = "brc-documents",
): Promise<string | null> {
  const path = storagePathFromUrl(fileUrl, bucket);
  if (!path) return null;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
