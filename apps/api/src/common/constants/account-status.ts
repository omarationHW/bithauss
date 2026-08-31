/**
 * Machine-readable error codes for account-state denials.
 *
 * The web client keys off `code` (never off the human message) to decide
 * whether to sign the session out and show the "cuenta desactivada" screen,
 * so these strings are part of the API contract — do not rename them without
 * updating `apps/web/src/lib/account-status.ts`.
 */
export const ACCOUNT_DISABLED_CODE = 'ACCOUNT_DISABLED';

export const ACCOUNT_DISABLED_MESSAGE =
  'Tu cuenta está desactivada. Escríbenos a soporte@bithauss.com para reactivarla.';

export const NOTARY_NOT_VERIFIED_CODE = 'NOTARY_NOT_VERIFIED';

export const NOTARY_NOT_VERIFIED_MESSAGE =
  'Tu alta como notario aún no ha sido verificada por BitHauss. Un administrador debe validar tu número de notaría antes de que puedas operar expedientes.';
