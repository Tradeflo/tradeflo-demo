type OnboardingProgressProps = { currentStep: number };

/** Three steps: business, work logs, finish. */
export function OnboardingProgress({ currentStep }: OnboardingProgressProps) {
  return (
    <div className="prog">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className={`pg${i === currentStep ? " active" : ""}${i < currentStep ? " done" : ""}`}
        />
      ))}
    </div>
  );
}
