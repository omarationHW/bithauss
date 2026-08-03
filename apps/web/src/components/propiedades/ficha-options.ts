/**
 * Shared options for the downloadable "ficha técnica" PDF.
 *
 * Lives in its own module so the off-screen template, the html2canvas/jsPDF
 * helper and the options dialog all agree on the same shape without importing
 * each other.
 */

export type FichaOrientation = "portrait" | "landscape";

/** "single" = 1-page summary sheet, "full" = cover + details + gallery pages. */
export type FichaLayout = "single" | "full";

export interface FichaOptions {
  orientation: FichaOrientation;
  layout: FichaLayout;
  /**
   * Only meaningful for the "full" layout — the 1-page sheet always renders a
   * fixed strip of thumbnails because anything else would overflow the page.
   */
  includeAllPhotos: boolean;
}

export const DEFAULT_FICHA_OPTIONS: FichaOptions = {
  orientation: "portrait",
  layout: "full",
  includeAllPhotos: true,
};

const STORAGE_KEY = "bithauss:ficha-options";

function isValid(value: unknown): value is FichaOptions {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.orientation === "portrait" || v.orientation === "landscape") &&
    (v.layout === "single" || v.layout === "full") &&
    typeof v.includeAllPhotos === "boolean"
  );
}

/** Last choice made during this browser session (falls back to the defaults). */
export function readFichaOptions(): FichaOptions {
  if (typeof window === "undefined") return DEFAULT_FICHA_OPTIONS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FICHA_OPTIONS;
    const parsed: unknown = JSON.parse(raw);
    return isValid(parsed) ? parsed : DEFAULT_FICHA_OPTIONS;
  } catch {
    // Private mode / disabled storage — defaults are good enough.
    return DEFAULT_FICHA_OPTIONS;
  }
}

export function saveFichaOptions(options: FichaOptions): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Non-fatal: the download still works, we just won't remember the choice.
  }
}
