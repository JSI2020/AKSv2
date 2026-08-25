import type { ProductionTimelineStep } from "../status";

type ProductionTimelineProps = {
  steps: ProductionTimelineStep[];
  photos?: Array<{ stage: string; readUrl: string | null }>;
};

function photoForStep(
  step: ProductionTimelineStep,
  photos: Array<{ stage: string; readUrl: string | null }>,
) {
  const label = step.label.toLowerCase();
  const key = step.key.toLowerCase();
  return photos.find((p) => {
    const stage = p.stage.toLowerCase();
    return (
      stage.includes(key) ||
      stage.includes(label) ||
      (step.key === "CUTTING" && stage.includes("cut")) ||
      (step.key === "STITCHING" && stage.includes("stitch"))
    );
  });
}

export function ProductionTimeline({
  steps,
  photos = [],
}: ProductionTimelineProps) {
  return (
    <ol className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const photo = photoForStep(step, photos);
        const showMessage =
          step.state === "complete" || step.state === "current";
        const dotClass =
          step.state === "complete"
            ? "border-chalk bg-chalk"
            : step.state === "current"
              ? "border-madder bg-milk shadow-[0_0_0_4px_rgba(140,47,57,0.12)]"
              : "border-ink/20 bg-milk";
        const lineClass =
          step.state === "complete" ? "bg-chalk" : "bg-ink/12";

        return (
          <li key={step.key} className="flex gap-4">
            <div className="flex w-4 shrink-0 flex-col items-center">
              <span
                className={`mt-1 size-3.5 shrink-0 rounded-full border-2 ${dotClass}`}
                aria-hidden
              />
              {!isLast ? (
                <span
                  className={`mt-0.5 w-0.5 flex-1 ${lineClass}`}
                  aria-hidden
                />
              ) : null}
            </div>
            <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
              <p
                className={`font-display text-[1.2rem] font-light ${
                  step.state === "current"
                    ? "text-ink"
                    : step.state === "complete"
                      ? "text-ink/80"
                      : "text-ink/45"
                }`}
              >
                {step.label}
              </p>
              {showMessage ? (
                <p className="mt-0.5 text-[12.5px] text-ink/55">
                  {step.message}
                </p>
              ) : null}
              {step.atLabel &&
              (step.state === "complete" || step.state === "current") ? (
                <p className="mt-1 font-data text-[10px] text-chalk">
                  {step.atLabel}
                </p>
              ) : null}
              {photo?.readUrl &&
              (step.state === "complete" || step.state === "current") ? (
                <div className="relative mt-3 max-w-[200px] overflow-hidden border border-ink/12">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.readUrl}
                    alt={photo.stage}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <span className="absolute bottom-2 inset-inline-start-2 bg-milk/80 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.1em] text-ink/55">
                    {photo.stage}
                  </span>
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
