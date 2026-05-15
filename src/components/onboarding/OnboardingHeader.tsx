import Link from "next/link";
import { LogoutButton } from "@/components/auth/logout-button";
import { HeaderNavLinks } from "@/components/nav/HeaderNavLinks";

export function OnboardingHeader() {
  return (
    <header className="header">
      <Link href="/" className="logo" style={{ textDecoration: "none" }}>
        <span className="logo-dot" />
        Tradeflo AI
      </Link>
      <div className="header-right">
        <span className="header-label">Account setup</span>
        <HeaderNavLinks />
        <LogoutButton />
      </div>
    </header>
  );
}
