// ──────────────────────────────────────────────
// Application
// ──────────────────────────────────────────────
export const APP_NAME = 'BitHauss';
export const APP_TAGLINE = 'Bienes Raíces Certificados';
export const DEFAULT_COUNTRY = 'MX';
export const DEFAULT_CURRENCY = 'MXN';
export const SUPPORTED_CURRENCIES = ['MXN', 'USD'] as const;

// ──────────────────────────────────────────────
// Property limits
// ──────────────────────────────────────────────
export const MAX_PROPERTY_IMAGES = 30;
export const MAX_FILE_SIZE_MB = 50;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

// ──────────────────────────────────────────────
// Pagination defaults
// ──────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ──────────────────────────────────────────────
// BRC document types
// ──────────────────────────────────────────────
export const BRC_DOCUMENT_TYPES = [
  { slug: 'escritura', name: 'Escritura pública', required: true },
  { slug: 'ine_propietario', name: 'INE del propietario', required: true },
  { slug: 'boleta_predial', name: 'Boleta predial', required: true },
  { slug: 'recibo_agua', name: 'Recibo de agua', required: true },
  { slug: 'acta_matrimonio', name: 'Acta de matrimonio', required: false },
  { slug: 'poder_notarial', name: 'Poder notarial', required: false },
  { slug: 'certificado_libertad_gravamen', name: 'Certificado de libertad de gravamen', required: false },
  { slug: 'avaluo', name: 'Avalúo', required: false },
  { slug: 'plano_catastral', name: 'Plano catastral', required: false },
] as const;

// ──────────────────────────────────────────────
// Supported media types
// ──────────────────────────────────────────────
export const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const SUPPORTED_DOCUMENT_TYPES = ['application/pdf', ...SUPPORTED_IMAGE_TYPES] as const;

// ──────────────────────────────────────────────
// BRC certificate
// ──────────────────────────────────────────────
export const BRC_CERTIFICATE_VALIDITY_DAYS = 365;
