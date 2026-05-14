/**
 * Safe error logger.
 *
 * In production, Supabase / PostgREST error objects expose internal schema
 * details (code, hint, details, the failing column/constraint name) when
 * passed to console.error. That information is visible to anyone with
 * DevTools open and can fingerprint the database.
 *
 * This helper logs only a human message in production while preserving
 * full diagnostics in development.
 */
export function logError(label: string, error: unknown) {
  if (process.env.NODE_ENV === "production") {
    const msg =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message ?? "Unknown error")
        : "Unknown error";
    // eslint-disable-next-line no-console
    console.error(`${label}: ${msg}`);
    return;
  }
  // eslint-disable-next-line no-console
  console.error(label, error);
}
