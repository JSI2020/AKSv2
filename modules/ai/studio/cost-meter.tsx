"use client";

type Props = {
  designSpendUsdMicros: number;
  attemptCount: number;
  monthlySpendUsdMicros: number;
  monthlyCapUsdMicros: number | null;
};

function formatUsd(micros: number): string {
  return (micros / 1_000_000).toFixed(2);
}

export function StudioCostMeter({
  designSpendUsdMicros,
  attemptCount,
  monthlySpendUsdMicros,
  monthlyCapUsdMicros,
}: Props) {
  const capPct =
    monthlyCapUsdMicros && monthlyCapUsdMicros > 0
      ? Math.min(100, (monthlySpendUsdMicros / monthlyCapUsdMicros) * 100)
      : 0;

  return (
    <div className="border border-indigo-lift bg-indigo px-4 py-3">
      <p className="text-[13px] text-greige">
        This design so far:{" "}
        <span className="text-zari">${formatUsd(designSpendUsdMicros)}</span>
        {" · "}
        {attemptCount} attempt{attemptCount === 1 ? "" : "s"}
      </p>
      {monthlyCapUsdMicros != null ? (
        <div className="mt-2">
          <div className="mb-1 flex justify-between text-[11px] text-chalk">
            <span>Monthly AI spend</span>
            <span>
              ${formatUsd(monthlySpendUsdMicros)} / $
              {formatUsd(monthlyCapUsdMicros)}
            </span>
          </div>
          <div
            className="h-1.5 bg-indigo-lift"
            role="progressbar"
            aria-valuenow={Math.round(capPct)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-zari transition-[width]"
              style={{ width: `${capPct}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
