import { Suspense } from "react";
import { QuoteBuilderApp } from "@/components/quote-builder";

export default function Home() {
  return (
    <main>
      <Suspense
        fallback={
          <div className="flex min-h-[40vh] items-center justify-center text-sm text-muted-foreground">
            Loading…
          </div>
        }
      >
        <QuoteBuilderApp />
      </Suspense>
    </main>
  );
}
