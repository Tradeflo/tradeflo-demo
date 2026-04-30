import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Sign up — Tradeflo AI",
  description: "Create your Tradeflo AI account",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo =
    typeof next === "string" && next.length > 0
      ? safeNextPath(next)
      : "/onboarding";

  return (
    <AuthShell
      title="Create your account"
      description="Use your work email and a strong password. You’ll use these credentials to save and send quotes."
    >
      <SignupForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
