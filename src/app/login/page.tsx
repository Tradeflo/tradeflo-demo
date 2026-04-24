import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/auth/safe-next-path";

export const metadata: Metadata = {
  title: "Log in — Tradeflo AI",
  description: "Sign in to Tradeflo AI",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const redirectTo = safeNextPath(next);

  return (
    <AuthShell
      title="Welcome back"
      description="Sign in to continue building and managing quotes."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
