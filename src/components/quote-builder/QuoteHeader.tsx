import { LogoutButton } from "@/components/auth/logout-button";
import { OnboardingHeaderLink } from "@/components/onboarding/OnboardingHeaderLink";

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
        <OnboardingHeaderLink />
        <LogoutButton />
      </div>
    </header>
  );
}
