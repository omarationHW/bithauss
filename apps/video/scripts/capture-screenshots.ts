/**
 * Captures product screenshots from the running web app for use in
 * the Remotion compositions.
 *
 * Usage:
 *   1. Make sure the web app is reachable (BASE_URL, defaults to
 *      https://bithauss-web.azurewebsites.net — set BASE_URL=http://localhost:3000
 *      to capture the local dev version instead).
 *   2. From apps/video:  pnpm capture
 *
 * Output: apps/video/public/screenshots/{home,propiedades,detalle,brc}.png
 *
 * Pages captured here are the public ones — no login. If we ever need
 * a dashboard screenshot we'll have to authenticate first.
 */

import { chromium, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'https://bithauss-web.azurewebsites.net';
const VIEWPORT = { width: 1920, height: 1080 };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'screenshots');

type Target = {
  /** Output filename without extension. */
  name: string;
  /** Path relative to BASE_URL. */
  url: string;
  /** Extra wait so animations settle, in ms. */
  settleMs?: number;
  /** Optional setup hook before the screenshot. */
  before?: (page: Page) => Promise<void>;
};

const TARGETS: Target[] = [
  { name: 'home', url: '/', settleMs: 1200 },
  { name: 'propiedades', url: '/propiedades', settleMs: 1500 },
  // demo-1 is a hardcoded demo property baked into the detail page so
  // it works without seeded production data.
  { name: 'detalle', url: '/propiedades/demo-1', settleMs: 1500 },
  // Same page, scrolled to the características / amenidades block so
  // the demo can show the new common-areas list.
  {
    name: 'detalle-caracteristicas',
    url: '/propiedades/demo-1',
    settleMs: 1500,
    before: async (page) => {
      // Switch to the "Características" tab and scroll it into view.
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(
          (el) => el.textContent?.trim().toLowerCase().includes('caracter'),
        ) as HTMLElement | undefined;
        btn?.click();
      });
      await page.waitForTimeout(400);
      await page.evaluate(() => window.scrollTo({ top: 900, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(400);
    },
  },
  // Same page, scrolled to the ubicación block (map + BRC banner).
  {
    name: 'detalle-mapa',
    url: '/propiedades/demo-1',
    settleMs: 1500,
    before: async (page) => {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button[role="tab"]')).find(
          (el) => el.textContent?.trim().toLowerCase().includes('ubicaci'),
        ) as HTMLElement | undefined;
        btn?.click();
      });
      await page.waitForTimeout(600);
      await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' as ScrollBehavior }));
      await page.waitForTimeout(400);
    },
  },
  // Registration page: capture the three role states (Comprador default,
  // Broker, Inmobiliaria) so the demo can spotlight the new conditional
  // fields. We re-load between captures to reset state cleanly.
  { name: 'registro-comprador', url: '/auth/registro', settleMs: 800 },
  {
    name: 'registro-broker',
    url: '/auth/registro',
    settleMs: 800,
    before: async (page) => {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.trim() === 'Broker',
        ) as HTMLElement | undefined;
        btn?.click();
      });
      await page.waitForTimeout(400);
    },
  },
  {
    name: 'registro-inmobiliaria',
    url: '/auth/registro',
    settleMs: 800,
    before: async (page) => {
      await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('button')).find((b) =>
          b.textContent?.trim() === 'Inmobiliaria',
        ) as HTMLElement | undefined;
        btn?.click();
      });
      await page.waitForTimeout(400);
    },
  },
];

async function ensureOutDir() {
  await mkdir(OUT_DIR, { recursive: true });
}

async function capture(target: Target, page: Page) {
  const fullUrl = `${BASE_URL}${target.url}`;
  console.log(`→ ${target.name.padEnd(14)} ${fullUrl}`);
  await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 45_000 });
  if (target.before) await target.before(page);
  if (target.settleMs) await page.waitForTimeout(target.settleMs);

  // Hide cookie banners / live chat widgets if any get added later.
  await page.evaluate(() => {
    const selectors = ['[data-cookie-banner]', '.intercom-launcher'];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => ((el as HTMLElement).style.display = 'none'));
    }
  });

  // No clip — let the viewport define the captured area. Clipping
  // makes scrolled screenshots impossible because clip is in page
  // coordinates rather than viewport coordinates.
  const buffer = await page.screenshot({ type: 'png' });
  const file = path.join(OUT_DIR, `${target.name}.png`);
  await writeFile(file, buffer);
  console.log(`  saved ${file}`);
}

async function main() {
  await ensureOutDir();
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  try {
    for (const t of TARGETS) await capture(t, page);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
