import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">Privacy</h1>
      <p className="mt-4 text-sm text-muted-foreground">
        Placeholder. See your privacy policy document for full text.
      </p>
      <Link href="/signup" className="mt-6 inline-block text-sm text-primary">
        ← Back
      </Link>
    </main>
  );
}
