/**
 * Captura el flujo "cambiar la marca de agua de una propiedad" desde el
 * dashboard (requiere sesión). Corre contra el dev server local:
 *
 *   BASE_URL=http://localhost:3000 QA_EMAIL=… QA_PASSWORD=… pnpm tsx scripts/capture-marca-agua.ts
 *
 * Salida: public/screenshots/marca-agua/NN-<paso>.png (1920×1080) y
 * steps.json con las coordenadas del elemento clave de cada paso, para que
 * la composición de Remotion pueda hacer zoom y señalar exactamente ahí.
 */
import { chromium, type Page, type Locator } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const EMAIL = process.env.QA_EMAIL ?? '';
const PASSWORD = process.env.QA_PASSWORD ?? '';
const LOGO = process.env.WM_LOGO ?? path.resolve(process.cwd(), '..', 'web', 'public', 'images', 'bithauss-logo-blanco-1.png');
const VIEWPORT = { width: 1920, height: 1080 };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, '..', 'public', 'screenshots', 'marca-agua');

type Step = { file: string; title: string; focus?: { x: number; y: number; w: number; h: number } };
const steps: Step[] = [];

async function box(loc: Locator) {
  const b = await loc.boundingBox();
  return b ? { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) } : undefined;
}

async function shot(page: Page, name: string, title: string, focus?: Locator) {
  const file = `${String(steps.length + 1).padStart(2, '0')}-${name}.png`;
  await page.waitForTimeout(500);
  const f = focus ? await box(focus) : undefined;
  await page.screenshot({ path: path.join(OUT_DIR, file), fullPage: false });
  steps.push({ file, title, focus: f });
  console.log('✓', file, f ?? '');
}

async function main() {
  if (!EMAIL || !PASSWORD) throw new Error('QA_EMAIL / QA_PASSWORD requeridos');
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1, locale: 'es-MX' });

  // Login
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' });
  await page.getByPlaceholder(/Correo electr/i).fill(EMAIL);
  await page.getByPlaceholder(/contraseña/i).fill(PASSWORD);
  await page.getByRole('button', { name: /Iniciar sesión/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30000 });
  await page.waitForTimeout(2500);
  // Cierra bienvenida/tour si aparece
  for (const name of [/Explorar por mi cuenta/i, /Ahora no/i]) {
    const b = page.getByRole('button', { name });
    if (await b.isVisible().catch(() => false)) await b.click();
  }
  await page.keyboard.press('Escape');
  await page.waitForTimeout(800);

  // 1. Dashboard → Configuración
  const navConfig = page.locator('aside a[href="/dashboard/configuracion"]');
  await shot(page, 'dashboard', 'Entra a Configuración desde el menú lateral', navConfig);
  await navConfig.click();
  await page.waitForURL(/configuracion/);
  await page.waitForTimeout(2000);

  // 2. Sección Marca de agua
  const heading = page.getByRole('heading', { name: /Marca de agua/i });
  await heading.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -140));
  await page.waitForTimeout(600);
  const section = heading.locator('xpath=ancestor::div[contains(@class,"rounded-2xl")][1]');
  const toggle = section.locator('button.rounded-full').first();
  await shot(page, 'seccion', 'Busca la sección "Marca de agua"', section);

  // 3. Activar
  const enabledNow = (await toggle.getAttribute('style'))?.includes('gradient');
  if (!enabledNow) await toggle.click();
  await page.waitForTimeout(800);
  await shot(page, 'activar', 'Activa la marca de agua con el interruptor', toggle);

  // 4. Subir logo
  const subir = page.getByRole('button', { name: /Subir logo/i });
  await shot(page, 'imagen', 'Elige la imagen: sube tu logo o usa tu foto de perfil', subir);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), subir.click()]);
  await chooser.setFiles(LOGO);
  await page.waitForTimeout(4000);

  // 5. Posición
  const posInfDer = page.getByRole('button', { name: /^Inf\. der\.$/ });
  await posInfDer.click();
  await page.waitForTimeout(600);
  await shot(page, 'posicion', 'Elige la posición: esquinas, centro o mosaico', posInfDer.locator('xpath=..'));

  // 6. Opacidad y tamaño (sliders)
  const sliders = page.locator('input[type="range"]');
  const n = await sliders.count();
  if (n > 0) {
    await sliders.nth(0).fill('60');
    if (n > 1) await sliders.nth(1).fill('30');
    await page.waitForTimeout(600);
  }
  const opac = page.getByText(/^Opacidad/).first();
  await shot(page, 'ajustes', 'Ajusta opacidad y tamaño; la vista previa cambia al instante', opac.locator('xpath=ancestor::div[2]'));

  // 7. Vista previa
  const preview = page.getByAltText(/Marca de agua/i).first();
  await shot(page, 'preview', 'Revisa la vista previa sobre una foto real', preview.locator('xpath=ancestor::div[1]'));

  // 8. Aplicar a fotos existentes
  const aplicar = page.getByRole('button', { name: /^Aplicar a existentes/i });
  await aplicar.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await shot(page, 'aplicar', 'Pulsa "Aplicar a fotos existentes" para re-procesar tus propiedades publicadas', aplicar);
  await aplicar.click();
  await page.waitForTimeout(6000);
  await shot(page, 'resultado', 'Listo: tus fotos ya llevan la nueva marca de agua', aplicar.locator('xpath=ancestor::div[2]'));

  // 9. Mis propiedades (resultado visible)
  await page.goto(`${BASE_URL}/dashboard/propiedades`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);
  await shot(page, 'propiedades', 'Las fotos de tus propiedades ya muestran tu marca', page.locator('main').first());

  await writeFile(path.join(OUT_DIR, 'steps.json'), JSON.stringify({ viewport: VIEWPORT, steps }, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
