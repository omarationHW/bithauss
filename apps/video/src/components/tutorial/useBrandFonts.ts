import { useEffect, useState } from 'react';
import { continueRender, delayRender } from 'remotion';

const FONT_CSS =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@600;700;800&family=Inter:wght@400;500;600;700&display=block';
const FACES = ['600 40px Barlow', '700 40px Barlow', '800 40px Barlow', '400 30px Inter', '500 30px Inter', '600 30px Inter', '700 30px Inter'];
const TIMEOUT_MS = 8000;

let fontsPromise: Promise<void> | null = null;

/**
 * Loads Barlow + Inter (the site's typefaces) once per page. Never blocks
 * the render for long: if the network is unavailable the fallback stack
 * from brand.ts is used after a short timeout.
 */
const loadFonts = (): Promise<void> => {
  if (fontsPromise) return fontsPromise;
  fontsPromise = new Promise<void>((resolve) => {
    const finish = () => resolve();
    const timer = setTimeout(finish, TIMEOUT_MS);
    try {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = FONT_CSS;
      link.onload = () => {
        Promise.all(FACES.map((f) => document.fonts.load(f)))
          .then(() => document.fonts.ready)
          .then(() => {
            clearTimeout(timer);
            finish();
          }, finish);
      };
      link.onerror = finish;
      document.head.appendChild(link);
    } catch {
      finish();
    }
  });
  return fontsPromise;
};

export const useBrandFonts = () => {
  const [handle] = useState(() =>
    delayRender('Loading brand fonts', { timeoutInMilliseconds: TIMEOUT_MS + 10000 }),
  );
  useEffect(() => {
    loadFonts().then(() => continueRender(handle));
  }, [handle]);
};
