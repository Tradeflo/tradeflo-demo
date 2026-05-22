"use client";

import { ErrorBoundary } from "@sentry/react";
import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Catches client-side React render errors under the root layout and reports
 * them to Sentry (in addition to `app/error.tsx` for route-level errors).
 */
export function SentryAppBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      beforeCapture={(scope) => {
        scope.setTag("error_boundary", "root");
      }}
      fallback={({ resetError }) => (
        <div className="mx-auto flex min-h-[40vh] max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-muted-foreground text-sm">
            Try again or return home. We have been notified.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              className="bg-primary text-primary-foreground inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium"
              onClick={resetError}
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
      )}
    >
      {children}
    </ErrorBoundary>
  );
}
