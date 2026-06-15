import { createBrowserClient, type CookieOptions } from "@supabase/ssr";

/**
 * Name of the flag cookie that controls session persistence.
 * Set by the login page before sign-in.
 *   "true"  → keep auth cookies long-lived (default ~1y, "Remember me" ON)
 *   "false" → write auth cookies as session-only (cleared on browser close)
 */
const REMEMBER_FLAG = "bh_remember";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")}=([^;]*)`),
  );
  return m ? decodeURIComponent(m[1]!) : undefined;
}

/** Default to remembered when the flag is missing (preserves prior UX). */
function sessionShouldPersist(): boolean {
  return readCookie(REMEMBER_FLAG) !== "false";
}

function writeCookie(name: string, value: string, options: CookieOptions) {
  if (typeof document === "undefined") return;
  let cookie = `${name}=${encodeURIComponent(value)}`;
  if (options.domain) cookie += `; Domain=${options.domain}`;
  cookie += `; Path=${options.path ?? "/"}`;
  if (options.maxAge !== undefined) cookie += `; Max-Age=${options.maxAge}`;
  if (options.expires) {
    const d = options.expires instanceof Date ? options.expires : new Date(options.expires);
    cookie += `; Expires=${d.toUTCString()}`;
  }
  cookie += `; SameSite=${options.sameSite ?? "Lax"}`;
  if (options.secure || window.location.protocol === "https:") cookie += "; Secure";
  document.cookie = cookie;
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return readCookie(name);
        },
        set(name: string, value: string, options: CookieOptions) {
          // When "Remember me" is OFF, strip the persistence hints so the
          // browser treats Supabase auth cookies as session-only — they
          // disappear when the user closes the window.
          const opts = sessionShouldPersist()
            ? options
            : { ...options, maxAge: undefined, expires: undefined };
          writeCookie(name, value, opts);
        },
        remove(name: string, options: CookieOptions) {
          writeCookie(name, "", { ...options, maxAge: 0 });
        },
      },
    },
  );
}
