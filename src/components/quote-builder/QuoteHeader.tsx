import { LogoutButton } from "@/components/auth/logout-button";

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
        <LogoutButton />
      </div>
    </header>
  );
}
