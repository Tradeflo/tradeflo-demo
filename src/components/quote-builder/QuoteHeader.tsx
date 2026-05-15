import type { ReactNode } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
import { HeaderNavLinks } from "@/components/nav/HeaderNavLinks";
import { OnboardingHeaderLink } from "@/components/onboarding/OnboardingHeaderLink";

export function QuoteHeader({ saveDraft }: { saveDraft?: ReactNode }) {
  return (
    <header className="header">
      <div className="logo">
        <span className="logo-dot" />
        Tradeflo AI
      </div>
      <div className="header-right">
        <div className="live-dot" />
        <span className="header-label">Quote Builder</span>
        {saveDraft ? (
          <span className="qb-header-save">{saveDraft}</span>
        ) : null}
        <OnboardingHeaderLink />
        <HeaderNavLinks />
        <LogoutButton />
      </div>
    </header>
  );
}
