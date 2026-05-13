import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Terms of service</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Placeholder. Replace with your legal terms.
      </p>
      <Link href="/signup" className="mt-6 inline-block text-sm text-primary">
        ← Back
      </Link>
    </main>
  );
}
