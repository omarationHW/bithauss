/**
 * Client-side reaction to an account-state denial from the API (BH-04).
 *
 * The API answers 403 with a machine-readable `code` (see
 * `apps/api/src/common/constants/account-status.ts`). Keying off the code
 * rather than the Spanish message keeps the two sides from drifting the next
 * time someone rewords the copy.
 */

export const ACCOUNT_DISABLED_CODE = "ACCOUNT_DISABLED";
export const NOTARY_NOT_VERIFIED_CODE = "NOTARY_NOT_VERIFIED";

export function isAccountDisabledResponse(
  status: number,
  data: unknown,
): boolean {
  if (status !== 403) return false;
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { code?: unknown }).code === ACCOUNT_DISABLED_CODE
  );
}

/**
 * Ends the local session and sends the user to the login screen with an
 * explanation. A deactivated user who keeps clicking around a dashboard that
 * 403s on every call has no way to understand what happened.
 */
export async function expireDisabledSession(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const { createClient } = await import("@/lib/supabase/client");
    await createClient().auth.signOut();
  } catch {
    /* signing out is best-effort; the redirect is what the user needs */
  }
  window.location.assign("/auth/login?error=cuenta_desactivada");
}
