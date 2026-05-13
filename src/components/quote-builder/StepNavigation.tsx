"use client";

const STEPS = [
  "Job intake",
  "Review quote",
  "Client preview",
  "Send",
] as const;

type StepNavigationProps = {
  currentStep: number;
  onGoTo: (index: number) => void;
};

export function StepNavigation({ currentStep, onGoTo }: StepNavigationProps) {
  return (
    <nav className="step-bar" aria-label="Quote steps">
      <div className="step-bar-inner">
        {STEPS.map((label, i) => {
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <button
              key={label}
              type="button"
              className={`sb${active ? " active" : ""}${done ? " done" : ""}`}
              onClick={() => onGoTo(i)}
            >
              <span className="sb-num">{done ? "✓" : i + 1}</span>
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
