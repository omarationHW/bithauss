import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SIGNUP_ROLE } from "@/lib/auth-roles";
import { logError } from "@/lib/log";

/**
 * Only same-origin relative paths may be used as the post-login destination.
 * Without this, `/auth/callback?next=https://evil.example` turns the callback
 * into an open redirect that inherits BitHauss' credibility.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile exists, create if not
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id, is_active")
        .eq("id", data.user.id)
        .maybeSingle();

      if (!existingProfile) {
        const metadata = data.user.user_metadata;
        // BH-01: the role NEVER comes from user_metadata. It was not only a
        // privilege-escalation vector (the user can rewrite that object at
        // will) — the previous default was the lowercase string "comprador",
        // which the `user_role` enum rejects, so every OAuth profile insert
        // failed silently and the user landed on an empty dashboard.
        const { error: insertError } = await supabase.from("profiles").insert({
          id: data.user.id,
          email: data.user.email,
          first_name:
            metadata?.full_name?.split(" ")[0] ?? metadata?.first_name ?? "",
          last_name:
            metadata?.full_name?.split(" ").slice(1).join(" ") ??
            metadata?.last_name ??
            "",
          avatar_url: metadata?.avatar_url ?? null,
          role: DEFAULT_SIGNUP_ROLE,
        });
        if (insertError) {
          logError("callback: profile insert failed", insertError);
          return NextResponse.redirect(`${origin}/auth/login?error=callback_error`);
        }
      } else if (existingProfile.is_active === false) {
        // BH-04: a deactivated account must not get a fresh session just
        // because it came back through the OAuth door.
        await supabase.auth.signOut();
        return NextResponse.redirect(
          `${origin}/auth/login?error=cuenta_desactivada`,
        );
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=callback_error`);
}
