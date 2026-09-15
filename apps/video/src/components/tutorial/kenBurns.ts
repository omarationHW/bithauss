import type { Focus } from './timeline';

/**
 * Camera math for the screenshot "ken burns" move.
 *
 * The 1920×1080 capture is drawn inside a rounded frame (SCREEN) and
 * zoomed toward the step's focus rectangle. All helpers work in
 * composition pixels so overlays (spotlight, cursor) can be drawn in
 * screen space and stay pixel-aligned with the moving image.
 */

/** Where the screenshot frame sits inside the 1920×1080 canvas. */
export const SCREEN = { x: 64, y: 36, w: 1792, h: 1008 } as const;
/** Native size of the captures. */
export const SOURCE = { w: 1920, h: 1080 } as const;
/** Scale from capture pixels to frame pixels (no zoom). */
export const BASE_SCALE = SCREEN.w / SOURCE.w;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  /** Zoom factor applied around the frame centre. */
  z: number;
  /** Post-zoom translation (frame px). */
  tx: number;
  ty: number;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * How far to zoom for a given focus: small targets (toggle, button)
 * get ~2.1×, wide sections a gentle ~1.15×.
 */
export const targetZoom = (focus: Focus) => {
  const fit = Math.min(
    SCREEN.w / (focus.w * BASE_SCALE),
    SCREEN.h / (focus.h * BASE_SCALE),
  );
  return clamp(fit * 0.55, 1.15, 2.1);
};

/** Frames the zoom-in takes before settling into a slow drift. */
export const zoomInFrames = (sceneFrames: number) => Math.min(48, Math.round(sceneFrames * 0.45));

/** Camera state for a frame of a scene focused on `focus`. */
export const getCamera = (focus: Focus, frame: number, sceneFrames: number): Camera => {
  const zEnd = targetZoom(focus);
  const zoomFrames = zoomInFrames(sceneFrames);
  const p = easeInOutCubic(clamp(frame / zoomFrames, 0, 1));
  const drift = clamp((frame - zoomFrames) / Math.max(1, sceneFrames - zoomFrames), 0, 1);
  const z = 1 + (zEnd - 1) * p + (zEnd - 1) * 0.06 * drift;

  const cx = SCREEN.w / 2;
  const cy = SCREEN.h / 2;
  const fx = (focus.x + focus.w / 2) * BASE_SCALE;
  const fy = (focus.y + focus.h / 2) * BASE_SCALE;

  // Bring the focus centre to the frame centre, but never reveal the
  // image edges.
  const tx = clamp(-(fx - cx) * z, -cx * (z - 1), cx * (z - 1));
  const ty = clamp(-(fy - cy) * z, -cy * (z - 1), cy * (z - 1));
  return { z, tx, ty };
};

/** Camera once the zoom has landed (used to place UI that must not cover the focus). */
export const landedCamera = (focus: Focus, sceneFrames: number) =>
  getCamera(focus, zoomInFrames(sceneFrames), sceneFrames);

/** Capture-pixel point → composition pixel point under `cam`. */
export const projectPoint = (px: number, py: number, cam: Camera) => {
  const cx = SCREEN.w / 2;
  const cy = SCREEN.h / 2;
  return {
    x: SCREEN.x + cx + (px * BASE_SCALE - cx) * cam.z + cam.tx,
    y: SCREEN.y + cy + (py * BASE_SCALE - cy) * cam.z + cam.ty,
  };
};

/** Capture-pixel rect → composition pixel rect under `cam`. */
export const projectRect = (r: Rect, cam: Camera): Rect => {
  const p = projectPoint(r.x, r.y, cam);
  return { x: p.x, y: p.y, w: r.w * BASE_SCALE * cam.z, h: r.h * BASE_SCALE * cam.z };
};

export const inflate = (r: Rect, pad: number): Rect => ({
  x: r.x - pad,
  y: r.y - pad,
  w: r.w + pad * 2,
  h: r.h + pad * 2,
});

export const intersects = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
