import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Check if profile exists, create if not
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existingProfile) {
        const metadata = data.user.user_metadata;
        await supabase.from("profiles").insert({
          id: data.user.id,
          first_name: metadata?.full_name?.split(" ")[0] ?? metadata?.first_name ?? null,
          last_name: metadata?.full_name?.split(" ").slice(1).join(" ") ?? metadata?.last_name ?? null,
          avatar_url: metadata?.avatar_url ?? null,
          role: metadata?.role ?? "comprador",
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=callback_error`);
}
