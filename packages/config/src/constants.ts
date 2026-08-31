import { MEMBERSHIP_TIERS, getBrcDiscountPct } from './membership-plans';

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
  // Conditional: only for the sale of a house zoned for commercial use or
  // an office — see apps/web/src/lib/brc-documents.ts.
  { slug: 'uso_de_suelo', name: 'Constancia de Uso de Suelo autorizado del Inmueble', required: false },
  { slug: 'no_adeudo_mantenimiento', name: 'Constancia de No Adeudo de Cuotas de Mantenimiento', required: false },
  { slug: 'regimen_condominio', name: 'Escritura de Régimen de Propiedad en Condominio', required: false },
  // Accepts several files: one ID per co-owner.
  { slug: 'identificacion_propietario', name: 'Identificación del Propietario', required: true, allowsMultiple: true },
  // Only applies when the owner is married.
  { slug: 'acta_matrimonio', name: 'Acta de Matrimonio del Propietario', required: false },
  { slug: 'comprobante_domicilio', name: 'Comprobante de Domicilio con la dirección del Inmueble', required: true },
  { slug: 'poder_notarial', name: 'Poder Notarial para actos de Administración', required: false },
  // Catch-all slot for anything else the owner wants to attach.
  { slug: 'otros_documentos', name: 'Otros documentos', required: false, allowsMultiple: true },
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

// ──────────────────────────────────────────────
// BRC pricing (official tariff table 2026)
// ──────────────────────────────────────────────
/**
 * Official price list — "Precios para obtener el Certificado BRC en el Portal
 * Inmobiliario bithauss.com". Amounts are the BASE fee in MXN, before the
 * membership discount, VAT and the payment-gateway fee.
 *
 * Bracket boundaries are INCLUSIVE on the upper bound and EXCLUSIVE on the
 * lower one, so a property worth exactly $5,000,000 pays $10,000 ("Hasta 5
 * mdp") and $5,000,000.01 already falls into "De 5 a 10 mdp". Keeping the
 * table ordered ascending lets the lookup be "first bracket whose max covers
 * the value", which is why `maxMxn` is null only on the last row.
 */
export const BRC_TARIFF_BRACKETS = [
  { id: 'HASTA_5M',  minMxn: 0,          maxMxn: 5_000_000,  amountMxn: 10_000, label: 'Hasta 5 mdp' },
  { id: 'DE_5_10M',  minMxn: 5_000_000,  maxMxn: 10_000_000, amountMxn: 15_000, label: 'De 5 a 10 mdp' },
  { id: 'DE_10_20M', minMxn: 10_000_000, maxMxn: 20_000_000, amountMxn: 20_000, label: 'De 10 a 20 mdp' },
  { id: 'DE_20_30M', minMxn: 20_000_000, maxMxn: 30_000_000, amountMxn: 30_000, label: 'De 20 a 30 mdp' },
  { id: 'DE_30_40M', minMxn: 30_000_000, maxMxn: 40_000_000, amountMxn: 40_000, label: 'De 30 a 40 mdp' },
  { id: 'MAS_40M',   minMxn: 40_000_000, maxMxn: null,       amountMxn: 50_000, label: 'Superior a 40 mdp' },
] as const;

export type BrcTariffBracketId = (typeof BRC_TARIFF_BRACKETS)[number]['id'];

/** Mexican VAT applied to the BRC service. */
export const IVA_RATE = 0.16;

/**
 * Discount applied to the BRC BASE fee per membership tier, as a FRACTION
 * (0.10 = 10%).
 *
 * DERIVED, never transcribed. It used to be a hand-written literal map here
 * while `membership-plans.ts` held the same six numbers as percentage points
 * (`getBrcDiscountPct` returns 5, not 0.05). Two independent transcriptions of
 * one business rule is exactly how the client ends up quoted a different price
 * from the one the server charges, so this map is now computed from
 * MEMBERSHIP_CATALOG — the single place the catalogue is transcribed from the
 * PDF — and the unit conversion (percentage points → fraction) happens once,
 * here.
 *
 * Tiers not listed (the retired MVP BASICO/PRO/PREMIUM) pay full price.
 */
export const BRC_MEMBERSHIP_DISCOUNT_PCT: Record<string, number> =
  Object.fromEntries(
    MEMBERSHIP_TIERS.map((tier) => [tier, getBrcDiscountPct(tier) / 100]),
  );

// ──────────────────────────────────────────────
// Payment gateway (Stripe México)
// ──────────────────────────────────────────────
/**
 * Stripe México domestic card pricing: 3.6% + $3.00 MXN per successful
 * charge. Stripe invoices that commission WITH VAT, so the real cost to
 * BitHauss is the rate grossed up by `IVA_RATE` (see STRIPE_FEE_IS_TAXED).
 *
 * Update these three constants — never the UI — if Stripe changes its
 * pricing or if a different gateway is adopted.
 */
export const STRIPE_MX_CARD_PCT = 0.036;
export const STRIPE_MX_CARD_FIXED_MXN = 3.0;
/** Whether the gateway commission itself carries VAT (true in Mexico). */
export const STRIPE_FEE_IS_TAXED = true;

/**
 * Business decision: the gateway commission is PASSED ON to the customer
 * (gross-up), so BitHauss always nets `subtotal + IVA`. Flip to false only if
 * the company decides to absorb it — the calculator honours the flag.
 *
 * IMPORTANT: "passed on" is about WHO PAYS, not about what is shown. The
 * customer pays it inside the service price and never sees it itemised —
 * see STRIPE_FEE_SHOWN_TO_CUSTOMER.
 */
export const STRIPE_FEE_PASSED_TO_CUSTOMER = true;

/**
 * Whether the gateway commission is itemised in the customer-facing
 * breakdown. FALSE by explicit client instruction: the fee is absorbed into
 * the quoted service price ("se suma al precio la comisión y el IVA"), so the
 * UI shows only `Certificación BRC`, `IVA` and `Total a pagar`.
 *
 * The fee is still computed and STORED on the payment row: accounting needs
 * it to reconcile against Stripe's settlement report. Hiding it is a
 * presentation rule, never a bookkeeping one.
 */
export const STRIPE_FEE_SHOWN_TO_CUSTOMER = false;

/** Currency the BRC certificate is always charged in. */
export const BRC_CHARGE_CURRENCY = 'MXN';

/**
 * Fallback USD→MXN rate used to place a USD-priced property in the MXN
 * tariff table. TEMPORARY default: it must be fed from the FX ticker /
 * remote config before go-live, otherwise a devalued default under-quotes
 * expensive listings.
 */
export const USD_TO_MXN_FALLBACK_RATE = 18.5;

// ──────────────────────────────────────────────
// Legal copy
// ──────────────────────────────────────────────
/**
 * Legal notice shown next to the BRC payment button. Reviewed by legal —
 * reproduce VERBATIM, do not reword or summarise.
 */
export const BRC_PAYMENT_NO_REFUND_NOTICE =
  'Una vez completada la transacción y autorizado el pago, el servicio de certificación inmobiliaria se considerará iniciado. Al tratarse de la prestación de un servicio digital de inicio inmediato al pago, el usuario renuncia a su derecho de desistimiento, por lo que no se realizarán reembolsos ni cancelaciones bajo ninguna circunstancia.';
