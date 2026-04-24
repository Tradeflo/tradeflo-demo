"use client";

import "./quote-builder.css";
import { IntakeStep } from "./IntakeStep";
import { PreviewStep } from "./PreviewStep";
import { ProgressDots } from "./ProgressDots";
import { QuoteFooter } from "./QuoteFooter";
import { QuoteHeader } from "./QuoteHeader";
import { ReviewStep } from "./ReviewStep";
import { SendStep } from "./SendStep";
import { StepNavigation } from "./StepNavigation";
import { useQuoteBuilderModel } from "./useQuoteBuilderModel";

export function QuoteBuilderApp() {
  const model = useQuoteBuilderModel();

  return (
    <div className="qb-app">
      {model.persistError ? (
        <div className="qb-banner qb-banner-error" role="alert">
          {model.persistError}
        </div>
      ) : null}
      {model.isHydrating ? (
        <div className="qb-banner qb-banner-muted" aria-busy="true">
          Loading your quote…
        </div>
      ) : null}
      <div className="app">
        <QuoteHeader />
        <StepNavigation
          currentStep={model.currentStep}
          onGoTo={model.goTo}
        />
        <main className="main">
          <ProgressDots currentStep={model.currentStep} />
          {model.currentStep === 0 ? <IntakeStep model={model} /> : null}
          {model.currentStep === 1 ? <ReviewStep model={model} /> : null}
          {model.currentStep === 2 ? <PreviewStep model={model} /> : null}
          {model.currentStep === 3 ? <SendStep model={model} /> : null}
        </main>
        <QuoteFooter />
      </div>
    </div>
  );
}
