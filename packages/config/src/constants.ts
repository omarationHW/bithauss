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
  { slug: 'escritura_propiedad', name: 'Escritura de Propiedad del Inmueble a Certificar', required: true },
  { slug: 'folio_real', name: 'Folio Real del Inmueble (Constancia de Inscripción en el RPP)', required: false },
  { slug: 'resolucion_judicial', name: 'Resolución Judicial', required: false },
  { slug: 'ultima_boleta_predial', name: 'Última Boleta Predial del Inmueble', required: true },
  { slug: 'ultima_boleta_agua', name: 'Última Boleta de Agua del Inmueble', required: true },
  { slug: 'uso_de_suelo', name: 'Constancia de Uso de Suelo autorizado del Inmueble', required: true },
  { slug: 'no_adeudo_mantenimiento', name: 'Constancia de No Adeudo de Cuotas de Mantenimiento', required: false },
  { slug: 'regimen_condominio', name: 'Escritura de Régimen de Propiedad en Condominio', required: false },
  { slug: 'identificacion_propietario', name: 'Identificación del Propietario', required: true },
  { slug: 'acta_matrimonio', name: 'Acta de Matrimonio del Propietario', required: true },
  { slug: 'comprobante_domicilio', name: 'Comprobante de Domicilio con la dirección del Inmueble', required: true },
  { slug: 'poder_notarial', name: 'Poder Notarial para actos de Administración', required: false },
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
