import Link from "next/link";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Reset password</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Password reset by email is not wired yet. Use Supabase dashboard or
        contact support.
      </p>
      <Link href="/login" className="mt-6 inline-block text-sm text-primary">
        ← Back to log in
      </Link>
    </main>
  );
}
