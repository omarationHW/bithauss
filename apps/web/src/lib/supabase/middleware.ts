import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          // Honor the "Remember me" preference: when bh_remember=false the
          // user asked us not to persist sessions, so refreshed auth
          // cookies get written without Max-Age/Expires (session cookies).
          // Without this, every refresh on a server request would re-write
          // the cookies as persistent and undo the choice made at login.
          const persist = request.cookies.get("bh_remember")?.value !== "false";
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => {
            const opts = persist
              ? options
              : { ...options, maxAge: undefined, expires: undefined };
            supabaseResponse.cookies.set(name, value, opts);
          });
        },
      },
    },
  );

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Protected routes: redirect to login if not authenticated
  if (
    !user &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages
  if (
    user &&
    (pathname === "/auth/login" || pathname === "/auth/registro")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
