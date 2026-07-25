import type { ProductionTimelineStep } from "../status";

type ProductionTimelineProps = {
  steps: ProductionTimelineStep[];
};

export function ProductionTimeline({ steps }: ProductionTimelineProps) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const dotClass =
          step.state === "complete"
            ? "border-zari bg-zari"
            : step.state === "current"
              ? "border-madder bg-madder"
              : "border-greige-deep bg-greige";

        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={`mt-1 size-2.5 shrink-0 border ${dotClass}`}
                aria-hidden
              />
              {!isLast ? (
                <span
                  className={`my-1 w-px flex-1 ${
                    step.state === "complete" ? "bg-zari" : "bg-greige-deep"
                  }`}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className={`pb-5 ${isLast ? "pb-0" : ""}`}>
              <p
                className={`text-[15px] ${
                  step.state === "current"
                    ? "font-medium text-ink"
                    : step.state === "complete"
                      ? "text-ink/80"
                      : "text-ink/45"
                }`}
              >
                {step.label}
              </p>
              {step.state === "current" ? (
                <p className="mt-0.5 text-[13px] text-ink/55">You are here</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
