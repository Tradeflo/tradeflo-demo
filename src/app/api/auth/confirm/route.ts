import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Token exchange endpoint for email confirmation and password resets.
 * Handles the "Token Hash" flow (PKCE) as recommended by Supabase for SSR.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/";
  // next may arrive as a full URL (e.g. http://localhost:3000/onboarding)
  // or a plain path (/onboarding) — extract just the pathname either way.
  const next = nextParam.startsWith("http")
    ? new URL(nextParam).pathname
    : nextParam;
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = next;
  // Clean up auth query params so they don't appear in the final URL
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      return NextResponse.redirect(redirectTo);
    }
  }

  // Redirect the user to an error page with some instructions
  redirectTo.pathname = "/";
  redirectTo.searchParams.set("auth_error", "1");
  return NextResponse.redirect(redirectTo);
}
