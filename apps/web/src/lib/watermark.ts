/**
 * Watermark utilities — bakes a logo / avatar into property photos on the
 * client (canvas) before they are uploaded, and provides helpers to load the
 * per-user watermark configuration (stored in Supabase auth user_metadata).
 *
 * Idempotency: watermarked objects are uploaded with a `-wm` suffix in their
 * storage path, so we can detect already-stamped photos without a DB column.
 */
import { createClient } from "@/lib/supabase/client";

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

/** True when a media URL already points at a watermarked object. */
export function isWatermarked(url: string): boolean {
  return /-wm\.[a-z0-9]+(\?|$)/i.test(url);
}

/** Load the current user's watermark config (merged with defaults). */
export async function loadWatermarkConfig(): Promise<WatermarkConfig> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const stored = user?.user_metadata?.preferences?.watermark as
    | Partial<WatermarkConfig>
    | undefined;
  return { ...DEFAULT_WATERMARK_CONFIG, ...(stored ?? {}) };
}

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
    img.onerror = (e) => {
      URL.revokeObjectURL(objectUrl);
      reject(e);
    };
    img.src = objectUrl;
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Required so the canvas is not tainted when exporting (works because
    // Supabase storage public URLs send permissive CORS headers).
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = url;
  });
}

/**
 * Composite the watermark onto `source` and return a new JPEG Blob.
 * If watermarking is not active, the original blob is returned untouched.
 */
export async function applyWatermark(
  source: Blob,
  cfg: WatermarkConfig
): Promise<Blob> {
  if (!isWatermarkActive(cfg) || !cfg.url) return source;

  let base: HTMLImageElement;
  let wm: HTMLImageElement;
  try {
    [base, wm] = await Promise.all([
      loadImageFromBlob(source),
      loadImageFromUrl(cfg.url),
    ]);
  } catch {
    // If anything fails to load, fall back to the original image rather than
    // blocking the upload.
    return source;
  }

  const w = base.naturalWidth;
  const h = base.naturalHeight;
  if (!w || !h || !wm.naturalWidth || !wm.naturalHeight) return source;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  // White backdrop so transparent source PNGs don't turn black in JPEG output.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(base, 0, 0, w, h);

  const wmW = Math.max(24, w * clamp(cfg.scale, 0.05, 0.5));
  const wmH = wmW * (wm.naturalHeight / wm.naturalWidth);
  const margin = Math.round(w * 0.025);
  ctx.globalAlpha = clamp(cfg.opacity, 0.05, 1);

  if (cfg.position === "TILE") {
    const stepX = wmW * 1.8;
    const stepY = wmH * 2.2;
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

  return new Promise<Blob>((resolve) => {
    canvas.toBlob(
      (blob) => resolve(blob ?? source),
      "image/jpeg",
      0.92
    );
  });
}

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
  return Math.min(max, Math.max(min, n));
}
