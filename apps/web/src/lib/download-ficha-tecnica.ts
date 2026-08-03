/**
 * Captures the off-screen <FichaTecnicaTemplate /> page-by-page with html2canvas
 * and assembles a multi-page A4 PDF via jsPDF.
 *
 * The template renders direct children marked `data-page="N"` sized to A4 at
 * 96 DPI — 794x1123 CSS px in portrait, 1123x794 in landscape. We render each
 * as its own PDF page so layout never stretches across page breaks. The caller
 * must pass the same orientation the template was rendered with.
 */

import { logError } from "./log";

/** A4 in millimetres. */
const A4_SHORT_MM = 210;
const A4_LONG_MM = 297;

export type FichaPdfOrientation = "portrait" | "landscape";

export interface DownloadFichaOptions {
  /** Container DOM element that holds one or more [data-page] children. */
  container: HTMLElement;
  /** File stem; ".pdf" is appended automatically. */
  filename: string;
  /** Must match the orientation the template rendered its pages with. */
  orientation?: FichaPdfOrientation;
}

export async function downloadFichaTecnica(opts: DownloadFichaOptions): Promise<void> {
  const { container, filename, orientation = "portrait" } = opts;
  const isLandscape = orientation === "landscape";
  const pageWidthMm = isLandscape ? A4_LONG_MM : A4_SHORT_MM;
  const pageHeightMm = isLandscape ? A4_SHORT_MM : A4_LONG_MM;

  const pages = Array.from(
    container.querySelectorAll<HTMLElement>("[data-page]"),
  ).sort((a, b) => {
    const an = Number(a.dataset.page ?? 0);
    const bn = Number(b.dataset.page ?? 0);
    return an - bn;
  });

  if (pages.length === 0) {
    throw new Error("No pages found to capture (missing [data-page] children).");
  }

  // Make sure fonts and images are ready before we capture anything.
  if (typeof document !== "undefined" && document.fonts) {
    try {
      await document.fonts.ready;
    } catch {
      // Best-effort — proceed regardless.
    }
  }
  await waitForImages(container);

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

  const pdf = new jsPDF({
    orientation,
    unit: "mm",
    format: "a4",
    compress: true,
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]!;
    const canvas = await html2canvas(page, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      imageTimeout: 15000,
      windowWidth: page.scrollWidth,
      windowHeight: page.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.92);
    if (i > 0) pdf.addPage("a4", orientation);
    pdf.addImage(
      imgData,
      "JPEG",
      0,
      0,
      pageWidthMm,
      pageHeightMm,
      undefined,
      "FAST",
    );
  }

  pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

/**
 * Resolves once every <img> inside the container has either loaded or errored.
 * Two failure modes the caller has run into:
 *   1. An image that 404'd before listeners attach is already
 *      `complete: true` with `naturalWidth: 0`. The original check required
 *      `naturalWidth > 0`, so failed images slipped past and the listener
 *      never fired — `waitForImages` then hung indefinitely and the download
 *      button stayed in the loading state.
 *   2. A slow CDN that never responds would still hang. A per-image timeout
 *      caps the wait at IMAGE_WAIT_TIMEOUT_MS.
 */
const IMAGE_WAIT_TIMEOUT_MS = 5000;

async function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map((img) => {
      // `complete` is true on both successful load AND error. If we got here
      // after either, there's nothing left to wait for — resolving prevents
      // the hang from past failures.
      if (img.complete) {
        if (img.naturalWidth === 0) {
          logError("ficha: image already failed before wait", { src: img.src });
        }
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        const cleanup = () => {
          clearTimeout(timer);
          img.removeEventListener("load", done);
          img.removeEventListener("error", onErr);
        };
        const done = () => {
          cleanup();
          resolve();
        };
        const onErr = (ev: Event) => {
          logError("ficha: image failed to load", { src: img.src, ev });
          done();
        };
        const timer = setTimeout(() => {
          logError("ficha: image wait timed out", { src: img.src });
          done();
        }, IMAGE_WAIT_TIMEOUT_MS);
        img.addEventListener("load", done);
        img.addEventListener("error", onErr);
      });
    }),
  );
}
