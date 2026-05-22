"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground text-sm">
        We were notified and will look into it. You can try again or return
        home.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
          onClick={() => reset()}
        >
          Try again
        </button>
        <Link
          href="/"
          className="border-input bg-background inline-flex h-9 items-center justify-center rounded-md border px-4 text-sm font-medium"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
