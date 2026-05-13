import type { Metadata } from "next";
import { Suspense } from "react";
import "@/components/quote-builder/quote-builder.css";
import { OnboardingApp } from "@/components/onboarding";

export const metadata: Metadata = {
  title: "Setup — Tradeflo AI",
  description: "Complete your Tradeflo AI business profile and work history",
};

export default function OnboardingPage() {
  return (
    <Suspense
      fallback={
        <div className="qb-app">
          <div
            className="qb-banner qb-banner-muted"
            style={{ fontFamily: "var(--qb-font, Instrument Sans), system-ui, sans-serif" }}
          >
            Loading…
          </div>
        </div>
      }
    >
      <OnboardingApp />
    </Suspense>
  );
}
