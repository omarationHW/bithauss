/**
 * Watermark utilities — bakes a logo / avatar into property photos on the
 * client (canvas) before they are uploaded, and provides helpers to load the
 * per-user watermark configuration (stored in Supabase auth user_metadata).
 *
 * Idempotency: watermarked objects are uploaded with a `-wm` suffix in their
 * storage path, so we can detect already-stamped photos without a DB column.
 *
 * Re-stamping: a watermark baked into a JPEG cannot be removed, so changing
 * the configuration (position / opacity / size / logo) can only be applied to
 * an *unstamped* source. `reprocess` in the settings page therefore keeps a
 * pristine copy of every photo it touches under `<uid>/<pid>/originals/` and
 * always re-derives the stamped image from that copy — otherwise every change
 * would bake a second watermark on top of the previous one.
 *
 * Cache busting: the generated object path embeds a signature of the visual
 * config (`watermarkSignature`), so a config change produces a *new* URL. That
 * is what makes the change visible immediately despite the CDN /
 * `cacheControl` headers on the previous object.
 */
import { createClient } from "@/lib/supabase/client";
import { logError } from "@/lib/log";

export type WatermarkPosition =
  | "BOTTOM_RIGHT"
  | "BOTTOM_LEFT"
  | "TOP_RIGHT"
  | "TOP_LEFT"
  | "CENTER"
  | "TILE";

export interface WatermarkConfig {
  /** Master on/off switch. */
  enabled: boolean;
  /** Where the watermark image comes from. */
  source: "CUSTOM" | "AVATAR";
  /** Resolved public URL of the image to stamp (uploaded logo or avatar). */
  url: string | null;
  position: WatermarkPosition;
  /** 0..1 */
  opacity: number;
  /** Watermark width as a fraction of the photo width (0.05..0.5). */
  scale: number;
  /** Epoch ms of the last successful save. Lets other screens detect staleness. */
  updatedAt?: number;
}

export const DEFAULT_WATERMARK_CONFIG: WatermarkConfig = {
  enabled: false,
  source: "CUSTOM",
  url: null,
  position: "BOTTOM_RIGHT",
  opacity: 0.55,
  scale: 0.2,
};

/** Marks a storage path as carrying a baked-in watermark. */
export const WM_SUFFIX = "-wm";

/** Bucket holding property photos (and the pristine originals we keep). */
export const WM_BUCKET = "properties";

/** Sub-folder (inside the owner/property prefix) holding pristine originals. */
export const ORIGINALS_DIR = "originals";

export const MIN_OPACITY = 0.05;
export const MAX_OPACITY = 1;
export const MIN_SCALE = 0.05;
export const MAX_SCALE = 0.5;

/** Margin as a fraction of the photo width — mirrored by the live preview. */
export const WM_MARGIN_RATIO = 0.025;
/** Horizontal / vertical tile spacing, as a multiple of the watermark size. */
export const TILE_STEP_X = 1.8;
export const TILE_STEP_Y = 2.2;

/** True when a media URL already points at a watermarked object. */
export function isWatermarked(url: string): boolean {
  return /-wm\.[a-z0-9]+(\?|$)/i.test(url);
}

/** Clamp + fill in defaults for a config coming from user_metadata. */
export function normalizeWatermarkConfig(
  raw: Partial<WatermarkConfig> | null | undefined
): WatermarkConfig {
  const merged = { ...DEFAULT_WATERMARK_CONFIG, ...(raw ?? {}) };
  return {
    ...merged,
    opacity: clamp(Number(merged.opacity), MIN_OPACITY, MAX_OPACITY),
    scale: clamp(Number(merged.scale), MIN_SCALE, MAX_SCALE),
    url: merged.url || null,
  };
}

/**
 * Load the current user's watermark config (merged with defaults).
 *
 * `supabase.auth.getUser()` performs a `GET /auth/v1/user` round-trip (it does
 * NOT decode the cached JWT), so the value returned here is always the one
 * persisted server-side — no stale metadata. Screens that stay mounted while
 * the settings page changes the config should additionally subscribe with
 * `onWatermarkConfigChange` to pick up the new value without a reload.
 */
export async function loadWatermarkConfig(): Promise<WatermarkConfig> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const stored = user?.user_metadata?.preferences?.watermark as
    | Partial<WatermarkConfig>
    | undefined;
  return normalizeWatermarkConfig(stored);
}

/* ------------------------------------------------------------------ */
/*  Cross-screen invalidation                                          */
/* ------------------------------------------------------------------ */

/** Same-tab DOM event fired after the config is persisted. */
export const WATERMARK_CONFIG_EVENT = "bithauss:watermark-config";
/** localStorage key used to propagate the change to other tabs. */
const WATERMARK_CONFIG_STORAGE_KEY = "bithauss:watermark-config-updated";

/** Notify every mounted screen (this tab and others) that the config changed. */
export function broadcastWatermarkConfigChange(cfg: WatermarkConfig): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<WatermarkConfig>(WATERMARK_CONFIG_EVENT, { detail: cfg })
  );
  try {
    window.localStorage.setItem(
      WATERMARK_CONFIG_STORAGE_KEY,
      String(cfg.updatedAt ?? Date.now())
    );
  } catch {
    /* storage may be unavailable (private mode) — same-tab event still fires */
  }
}

/**
 * Subscribe to watermark config changes. The callback receives the fresh
 * config. Returns an unsubscribe function.
 */
export function onWatermarkConfigChange(
  cb: (cfg: WatermarkConfig) => void
): () => void {
  if (typeof window === "undefined") return () => {};
  const onLocal = (e: Event) => {
    const detail = (e as CustomEvent<WatermarkConfig>).detail;
    if (detail) cb(normalizeWatermarkConfig(detail));
  };
  const onStorage = (e: StorageEvent) => {
    if (e.key !== WATERMARK_CONFIG_STORAGE_KEY) return;
    // Another tab saved: re-read from the server (always fresh).
    loadWatermarkConfig().then(cb).catch(() => {});
  };
  window.addEventListener(WATERMARK_CONFIG_EVENT, onLocal);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(WATERMARK_CONFIG_EVENT, onLocal);
    window.removeEventListener("storage", onStorage);
  };
}

/* ------------------------------------------------------------------ */
/*  Storage paths / versioning                                         */
/* ------------------------------------------------------------------ */

/**
 * Short, stable hash of everything that affects the rendered watermark.
 * Used as the version segment of the generated object path so that changing
 * any visual setting yields a brand-new URL (and therefore bypasses any CDN
 * or browser cache), while re-running with an unchanged config is a no-op.
 */
export function watermarkSignature(cfg: WatermarkConfig): string {
  const seed = [
    cfg.url ?? "",
    cfg.position,
    clamp(cfg.opacity, MIN_OPACITY, MAX_OPACITY).toFixed(2),
    clamp(cfg.scale, MIN_SCALE, MAX_SCALE).toFixed(2),
  ].join("|");
  // FNV-1a — good enough for cache keys, no crypto needed.
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36).padStart(7, "0").slice(0, 7);
}

/**
 * Stable identifier for a photo across re-stamps.
 *
 * It cannot be `property_media.id`: the property editor deletes and re-inserts
 * the whole media set on every save, so row ids change while the URL is kept.
 * The key therefore lives inside the generated object path and is read back
 * from the stored URL.
 */
export function newPhotoKey(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Storage path of the pristine (never stamped) copy of a photo.
 *
 * NOTE: the `properties` bucket is public, so this object is reachable by
 * anyone who knows the (random) photo key. That is the same exposure the app
 * already had — reprocessing never deleted the unstamped source either — but
 * moving originals to a private bucket would be the proper hardening.
 */
export function originalStoragePath(
  userId: string,
  propertyId: string,
  photoKey: string
): string {
  return `${userId}/${propertyId}/${ORIGINALS_DIR}/${photoKey}.orig`;
}

/** Storage path of the stamped derivative for a photo + config version. */
export function watermarkStoragePath(
  userId: string,
  propertyId: string,
  photoKey: string,
  signature: string
): string {
  return `${userId}/${propertyId}/wm/${photoKey}-${signature}${WM_SUFFIX}.jpg`;
}

/** Recover the photo key from a path produced by `watermarkStoragePath`. */
export function photoKeyFromWatermarkPath(path: string): string | null {
  const file = path.split("/").pop() ?? "";
  const m = /^(.+)-([0-9a-z]{1,8})-wm\.jpg$/i.exec(file);
  return m?.[1] ?? null;
}

/** True when `path` is a stamped derivative generated by this module. */
export function isGeneratedWatermarkPath(path: string, userId: string): boolean {
  return new RegExp(`^${escapeRe(userId)}/[^/]+/wm/`).test(path);
}

/**
 * Extract the object path from a Supabase Storage public URL, or null when the
 * URL does not belong to `bucket`.
 */
export function storagePathFromPublicUrl(
  url: string,
  bucket = WM_BUCKET
): string | null {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  const raw = url.slice(i + marker.length).split("?")[0] ?? "";
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** Append a cache-busting query param so viewers never get a stale render. */
export function withCacheBust(url: string, version: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}v=${encodeURIComponent(version)}`;
}

/* ------------------------------------------------------------------ */
/*  Image loading                                                      */
/* ------------------------------------------------------------------ */

/** Returns true if the config is usable for stamping. */
export function isWatermarkActive(cfg: WatermarkConfig): boolean {
  return cfg.enabled && !!cfg.url;
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("No se pudo decodificar la imagen."));
    };
    img.src = objectUrl;
  });
}

function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.href).origin === window.location.origin;
  } catch {
    return false;
  }
}

/**
 * Download an image as a Blob.
 *
 * Cross-origin hosts that do not send CORS headers (the Azure CDN photos) make
 * both `fetch` and `<img crossOrigin>` fail — and drawing such an image would
 * taint the canvas so `toBlob()` would throw. We therefore retry through the
 * same-origin `/api/proxy-image` route, and always feed the canvas from a Blob
 * object-URL, which can never taint it.
 */
export async function fetchImageAsBlob(url: string): Promise<Blob> {
  if (url.startsWith("data:") || url.startsWith("blob:") || isSameOrigin(url)) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`No se pudo descargar la imagen (${r.status}).`);
    return r.blob();
  }
  try {
    const r = await fetch(url, { mode: "cors" });
    if (r.ok) return await r.blob();
  } catch {
    /* falls through to the proxy */
  }
  const proxied = await fetch(`/api/proxy-image?url=${encodeURIComponent(url)}`);
  if (!proxied.ok) {
    throw new Error(
      `No se pudo descargar la imagen (proxy ${proxied.status}). ` +
        "Verifica que el host esté permitido en /api/proxy-image."
    );
  }
  return proxied.blob();
}

/** Cache the decoded watermark image so a batch run downloads it only once. */
const wmImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadWatermarkImage(url: string): Promise<HTMLImageElement> {
  const cached = wmImageCache.get(url);
  if (cached) return cached;
  const p = fetchImageAsBlob(url).then(loadImageFromBlob);
  wmImageCache.set(url, p);
  p.catch(() => wmImageCache.delete(url));
  return p;
}

/** Drop the cached watermark bitmap (call after uploading a new logo). */
export function clearWatermarkImageCache(): void {
  wmImageCache.clear();
}

/* ------------------------------------------------------------------ */
/*  Compositing                                                        */
/* ------------------------------------------------------------------ */

export interface WatermarkResult {
  /** The stamped JPEG, or the untouched source when `watermarked` is false. */
  blob: Blob;
  /** Whether the watermark was actually baked in. */
  watermarked: boolean;
  /** Human-readable reason when `watermarked` is false because of a failure. */
  error?: string;
}

/**
 * Composite the watermark onto `source`.
 *
 * Never throws: returns `{ watermarked: false, error }` so callers can decide
 * whether to surface the failure. Callers MUST NOT store the result under a
 * `-wm` path when `watermarked` is false, otherwise the photo would be
 * permanently flagged as stamped while carrying no watermark at all.
 */
export async function applyWatermarkDetailed(
  source: Blob,
  cfg: WatermarkConfig
): Promise<WatermarkResult> {
  if (!isWatermarkActive(cfg) || !cfg.url) {
    return { blob: source, watermarked: false };
  }

  let base: HTMLImageElement;
  let wm: HTMLImageElement;
  try {
    base = await loadImageFromBlob(source);
  } catch (err) {
    logError("watermark: cannot decode source photo", err);
    return {
      blob: source,
      watermarked: false,
      error: "No se pudo leer la foto original.",
    };
  }
  try {
    wm = await loadWatermarkImage(cfg.url);
  } catch (err) {
    logError("watermark: cannot load watermark image", err);
    return {
      blob: source,
      watermarked: false,
      error:
        "No se pudo cargar la imagen de la marca de agua. " +
        "Vuelve a subir el logo o usa tu foto de perfil.",
    };
  }

  const w = base.naturalWidth;
  const h = base.naturalHeight;
  if (!w || !h || !wm.naturalWidth || !wm.naturalHeight) {
    return {
      blob: source,
      watermarked: false,
      error: "La imagen o la marca de agua tienen dimensiones inválidas.",
    };
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return {
      blob: source,
      watermarked: false,
      error: "Tu navegador no permite procesar imágenes (canvas 2D).",
    };
  }

  // White backdrop so transparent source PNGs don't turn black in JPEG output.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);

  const wmW = Math.max(24, w * clamp(cfg.scale, MIN_SCALE, MAX_SCALE));
  const wmH = wmW * (wm.naturalHeight / wm.naturalWidth);
  const margin = Math.round(w * WM_MARGIN_RATIO);
  ctx.globalAlpha = clamp(cfg.opacity, MIN_OPACITY, MAX_OPACITY);

  if (cfg.position === "TILE") {
    const stepX = wmW * TILE_STEP_X;
    const stepY = wmH * TILE_STEP_Y;
    for (let y = margin; y < h; y += stepY) {
      for (let x = margin; x < w; x += stepX) {
        ctx.drawImage(wm, x, y, wmW, wmH);
      }
    }
  } else {
    const { x, y } = cornerPosition(cfg.position, w, h, wmW, wmH, margin);
    ctx.drawImage(wm, x, y, wmW, wmH);
  }

  ctx.globalAlpha = 1;

  try {
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
    });
    if (!blob) {
      return {
        blob: source,
        watermarked: false,
        error: "No se pudo exportar la imagen procesada.",
      };
    }
    return { blob, watermarked: true };
  } catch (err) {
    // Only reachable if the canvas was tainted, which the Blob-only image
    // loading above is designed to prevent.
    logError("watermark: canvas export failed", err);
    return {
      blob: source,
      watermarked: false,
      error: "No se pudo exportar la imagen procesada (canvas protegido).",
    };
  }
}

/**
 * Backwards-compatible wrapper: returns the stamped blob, or the original one
 * when stamping is disabled or fails. Prefer `applyWatermarkDetailed` when you
 * need to tell those two cases apart (e.g. to show an error to the user).
 */
export async function applyWatermark(
  source: Blob,
  cfg: WatermarkConfig
): Promise<Blob> {
  const { blob } = await applyWatermarkDetailed(source, cfg);
  return blob;
}

/* ------------------------------------------------------------------ */
/*  Geometry (shared with the settings preview)                        */
/* ------------------------------------------------------------------ */

function cornerPosition(
  pos: WatermarkPosition,
  w: number,
  h: number,
  wmW: number,
  wmH: number,
  margin: number
): { x: number; y: number } {
  switch (pos) {
    case "TOP_LEFT":
      return { x: margin, y: margin };
    case "TOP_RIGHT":
      return { x: w - wmW - margin, y: margin };
    case "BOTTOM_LEFT":
      return { x: margin, y: h - wmH - margin };
    case "CENTER":
      return { x: (w - wmW) / 2, y: (h - wmH) / 2 };
    case "BOTTOM_RIGHT":
    default:
      return { x: w - wmW - margin, y: h - wmH - margin };
  }
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
