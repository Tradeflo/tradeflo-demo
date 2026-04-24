type ProgressDotsProps = { currentStep: number };

export function ProgressDots({ currentStep }: ProgressDotsProps) {
  return (
    <div className="prog">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={`pg${i === currentStep ? " active" : ""}${i < currentStep ? " done" : ""}`}
        />
      ))}
    </div>
  );
}
