"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function OnboardingHeaderLink() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { completed?: boolean };
        if (!cancelled && data.completed === false) setShow(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  return (
    <Link href="/onboarding" className="qb-setup-link">
      Finish setup
    </Link>
  );
}
