"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type HeaderNavVariant = "admin" | "contractor";

export function HeaderNavLinks() {
  const pathname = usePathname();
  const [nav, setNav] = useState<HeaderNavVariant | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/nav/header");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as {
          nav?: HeaderNavVariant;
          billingWriteBlocked?: boolean;
        };
        if (
          !cancelled &&
          (data.nav === "admin" || data.nav === "contractor")
        ) {
          setNav(data.nav);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (nav === "admin") {
    if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
    return (
      <Link href="/admin" className="qb-setup-link">
        Go to admin
      </Link>
    );
  }

  if (nav === "contractor") {
    if (pathname === "/billing" || pathname.startsWith("/billing/"))
      return null;
    return (
      <Link href="/billing" className="qb-setup-link">
        Billing
      </Link>
    );
  }

  return null;
}
