/**
 * User-facing copy for the authentication flows (BH-21).
 *
 * Registration used to answer "Este correo ya está registrado", which turns
 * the public signup form into an account-existence oracle: feed it a list of
 * emails and you walk away with a roster of BitHauss users to phish. Login
 * already got this right; the two now share one module so a future edit
 * cannot regress just one of them.
 *
 * Rule: the *same* string for "no existe esa cuenta" and "la contraseña no es
 * correcta", and the *same* string for "ya existe" and "se creó". Whatever
 * disambiguation the user needs happens over email, where only the real owner
 * of the address can read it.
 */

/** Login: invalid email OR invalid password OR unknown account. */
export const LOGIN_INVALID_CREDENTIALS =
  "Correo electrónico o contraseña incorrectos.";

export const LOGIN_EMAIL_NOT_CONFIRMED =
  "Tu correo electrónico aún no ha sido confirmado. Revisa tu bandeja de entrada.";

export const LOGIN_RATE_LIMITED =
  "Demasiados intentos. Por favor espera unos minutos antes de intentar de nuevo.";

export const LOGIN_GENERIC_ERROR =
  "Ocurrió un error al iniciar sesión. Inténtalo de nuevo.";

export const LOGIN_ACCOUNT_DISABLED =
  "Tu cuenta está desactivada. Escríbenos a soporte@bithauss.com para reactivarla.";

/**
 * Registration: shown whether the address was free or already taken. If it was
 * taken, Supabase sends a "someone tried to register with your address" email
 * to the real owner — that is the channel where the ambiguity is resolved.
 */
export const SIGNUP_CHECK_YOUR_EMAIL =
  "Revisa tu correo electrónico: te enviamos las instrucciones para continuar con el registro.";

export const SIGNUP_INVALID_EMAIL =
  "Por favor ingresa un correo electrónico válido.";

export const SIGNUP_WEAK_PASSWORD =
  "La contraseña no cumple con los requisitos mínimos de seguridad.";

export const SIGNUP_RATE_LIMITED =
  "Demasiados intentos. Por favor espera unos minutos.";

export const SIGNUP_GENERIC_ERROR =
  "Ocurrió un error al crear tu cuenta. Inténtalo de nuevo.";

/** Minimum password length (BH-22). Supabase's own default is 6. */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_TOO_SHORT = `La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`;

/**
 * Maps a Supabase Auth sign-in error to user copy that never distinguishes
 * "this account does not exist" from "wrong password".
 */
export function loginErrorMessage(rawMessage: string | undefined): string {
  const msg = (rawMessage ?? "").toLowerCase();
  if (msg.includes("email not confirmed")) return LOGIN_EMAIL_NOT_CONFIRMED;
  if (msg.includes("rate limit") || msg.includes("too many"))
    return LOGIN_RATE_LIMITED;
  if (msg.includes("invalid login credentials") || msg.includes("invalid"))
    return LOGIN_INVALID_CREDENTIALS;
  if (msg.includes("user not found") || msg.includes("not found"))
    return LOGIN_INVALID_CREDENTIALS;
  return LOGIN_GENERIC_ERROR;
}

/**
 * Maps a Supabase Auth sign-up error to user copy.
 *
 * Returns `null` when the error should be presented as a *success*: an
 * already-registered address must look exactly like a fresh registration.
 */
export function signupErrorMessage(rawMessage: string | undefined): string | null {
  const msg = (rawMessage ?? "").toLowerCase();
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered") ||
    msg.includes("user already exists")
  ) {
    return null; // caller shows SIGNUP_CHECK_YOUR_EMAIL
  }
  if (
    msg.includes("valid email") ||
    msg.includes("invalid email") ||
    msg.includes("validate email") ||
    msg.includes("email address")
  )
    return SIGNUP_INVALID_EMAIL;
  if (msg.includes("password")) return SIGNUP_WEAK_PASSWORD;
  if (msg.includes("rate limit") || msg.includes("too many"))
    return SIGNUP_RATE_LIMITED;
  return SIGNUP_GENERIC_ERROR;
}
