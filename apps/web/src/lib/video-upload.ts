/**
 * Uploading property videos to Supabase Storage WITH a real progress bar.
 *
 * `supabase.storage.from(...).upload()` is built on `fetch`, which cannot
 * report upload progress and cannot be aborted mid-flight in a way the SDK
 * surfaces. A 200 MB walkthrough uploaded behind an indeterminate spinner
 * looks frozen, and brokers cancel the whole publication. So we talk to the
 * Storage REST endpoint directly with XMLHttpRequest, which still exposes
 * `upload.onprogress` and `abort()`.
 *
 * Object key layout — `<user_id>/<property_key>/<video_key>.<ext>` — mirrors
 * the photos bucket and, crucially, lets the Storage RLS policy in migration
 * 030 authorise a write with a single check: the first path segment must equal
 * `auth.uid()`. No user can write into another user's prefix.
 */

import { createClient } from "@/lib/supabase/client";
import { fileExtension } from "@/lib/property-video";

/** PUBLIC bucket holding property videos (created in migration 030). */
export const VIDEO_BUCKET = "property-videos";

export interface VideoUploadHandle {
  /** Resolves with the public URL of the stored object. */
  promise: Promise<string>;
  /** Aborts the in-flight request; the promise rejects with `UPLOAD_ABORTED`. */
  abort: () => void;
}

export const UPLOAD_ABORTED = "UPLOAD_ABORTED";

/** Random, unguessable object name so URLs cannot be enumerated. */
export function newVideoKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Storage prefix for a listing.
 *
 * On the "nueva propiedad" screen the row does not exist yet, so the caller
 * passes a client-generated draft key; the object is already under the user's
 * own prefix, so the eventual property id is irrelevant to authorisation.
 */
export function videoStoragePath(
  userId: string,
  propertyKey: string,
  videoKey: string,
  fileName: string,
): string {
  const ext = fileExtension(fileName) || "mp4";
  return `${userId}/${propertyKey}/${videoKey}.${ext}`;
}

export interface UploadVideoOptions {
  userId: string;
  propertyKey: string;
  file: File;
  /** 0-100. Called on every progress event. */
  onProgress?: (percent: number) => void;
  /** Detected from magic bytes — never `File.type`, which the client controls. */
  contentType?: string;
}

/**
 * Uploads one video and resolves with its public URL.
 *
 * Returns a handle instead of a bare promise so the UI can offer "Cancelar":
 * a stuck 200 MB upload must not hold the form hostage.
 */
export function uploadPropertyVideo(options: UploadVideoOptions): VideoUploadHandle {
  const { userId, propertyKey, file, onProgress, contentType } = options;

  const supabase = createClient();
  const path = videoStoragePath(userId, propertyKey, newVideoKey(), file.name);
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

  const xhr = new XMLHttpRequest();

  const promise = new Promise<string>((resolve, reject) => {
    void (async () => {
      // The Storage REST API authenticates with the user's own JWT, so the
      // bucket policies (and therefore the per-user prefix rule) apply exactly
      // as they would through the SDK.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const token = session?.access_token;
      if (!token) {
        reject(new Error("Tu sesión expiró. Vuelve a iniciar sesión para subir el video."));
        return;
      }

      xhr.open("POST", `${baseUrl}/storage/v1/object/${VIDEO_BUCKET}/${path}`, true);
      xhr.setRequestHeader("Authorization", `Bearer ${token}`);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.setRequestHeader("cache-control", "max-age=3600");
      if (contentType) xhr.setRequestHeader("content-type", contentType);

      xhr.upload.onprogress = (event) => {
        if (!event.lengthComputable) return;
        onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          onProgress?.(100);
          const {
            data: { publicUrl },
          } = supabase.storage.from(VIDEO_BUCKET).getPublicUrl(path);
          resolve(publicUrl);
          return;
        }
        // Storage answers 413 when the object exceeds the bucket's
        // file_size_limit — surface that as the size error, not a generic one.
        if (xhr.status === 413) {
          reject(new Error("El video excede el tamaño permitido por el servidor."));
          return;
        }
        reject(new Error(`No se pudo subir el video (error ${xhr.status}).`));
      };

      xhr.onerror = () =>
        reject(new Error("Se interrumpió la conexión durante la subida del video."));
      xhr.onabort = () => reject(new Error(UPLOAD_ABORTED));

      xhr.send(file);
    })();
  });

  return { promise, abort: () => xhr.abort() };
}

/**
 * Best-effort removal of an orphaned object (upload succeeded but the
 * publisher removed the video before saving). Never throws: a leftover file
 * is cheaper than a failed save.
 */
export async function deletePropertyVideoByUrl(url: string): Promise<void> {
  try {
    const marker = `/storage/v1/object/public/${VIDEO_BUCKET}/`;
    const idx = url.indexOf(marker);
    if (idx === -1) return;
    const path = decodeURIComponent(url.slice(idx + marker.length));
    await createClient().storage.from(VIDEO_BUCKET).remove([path]);
  } catch {
    /* non-fatal by design */
  }
}
