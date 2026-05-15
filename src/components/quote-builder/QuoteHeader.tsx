import { LogoutButton } from "@/components/auth/logout-button";
import { HeaderNavLinks } from "@/components/nav/HeaderNavLinks";

export function QuoteHeader() {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-dot" />
        Tradeflo AI
      </div>
      <div className="header-right">
        <div className="live-dot" />
        <span className="header-label">Quote Builder</span>
        <HeaderNavLinks />
        <LogoutButton />
      </div>
    </header>
  );
}
