import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signupServerSchema } from "@/lib/schemas/auth";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    // Validate input with the same schema used by the form
    const parsed = signupServerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { email, password } = parsed.data;

    // The post-signup destination is always decided by the server.
    // Never trust a client-supplied redirectTo for the confirmation email.
    const postSignupPath = "/onboarding";

    // Build the email redirect URL that Supabase will embed in the confirmation email.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";
    const emailRedirectTo = baseUrl
      ? `${baseUrl}${postSignupPath}`
      : undefined;

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // If email confirmation is disabled in Supabase, a session is returned
    // immediately — tell the client it can redirect straight away.
    const hasSession = !!data.session;
    return NextResponse.json({ hasSession }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred. Please try again." },
      { status: 500 },
    );
  }
}
