/**
 * Single source of truth for visual identity inside the videos.
 * Mirrors the web app's design tokens (Barlow titles, blue→green
 * gradient) so the video reads as a continuation of the site.
 */

export const COLORS = {
  blue: '#2563eb',     // hsl(221 83% 53%)
  blueDark: '#1d4ed8',
  green: '#10b981',    // hsl(160 84% 39%)
  ink: '#0f172a',
  inkSoft: '#475569',
  muted: '#94a3b8',
  cream: '#f8fafc',
  white: '#ffffff',
};

export const GRADIENT = `linear-gradient(135deg, ${COLORS.blue}, ${COLORS.green})`;

export const FONTS = {
  display: '"Barlow", "Inter", -apple-system, BlinkMacSystemFont, sans-serif',
  body: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
};

export const CDN = 'https://bithauss-images-fpdpe5auefacdweh.z03.azurefd.net/images';

export const LOGO_DARK = `${CDN}/Logo-BitHauss-Texto-Negro.png`;
export const LOGO_WHITE = `${CDN}/Logo-BitHauss.png`;
