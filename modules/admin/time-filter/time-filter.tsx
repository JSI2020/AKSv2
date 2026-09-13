"use client";

import { useQueryStates } from "nuqs";

import {
  TIME_RANGE_LABELS,
  TIME_RANGE_PRESETS,
  type TimeRangePreset,
} from "./time-range";
import { timeRangeNuqsParsers } from "./search-params";

type AdminTimeFilterProps = {
  className?: string;
  /** When false, omit the opt-out chip (finance/insights keep implicit month). */
  showAllTime?: boolean;
  /** Match the page's nuqs parsers — orders uses no default range. */
  parsers?: typeof timeRangeNuqsParsers;
};

/**
 * Today | 7 days | This month | This quarter | This year | Custom range.
 * Syncs `range`, `from`, `to` in the URL via nuqs.
 */
export function AdminTimeFilter({
  className,
  showAllTime = false,
  parsers = timeRangeNuqsParsers,
}: AdminTimeFilterProps) {
  const [params, setParams] = useQueryStates(parsers, {
    history: "push",
    shallow: false,
  });

  const preset = params.range ?? (showAllTime ? null : "month");

  return (
    <div
      className={["flex flex-wrap items-center gap-2", className]
        .filter(Boolean)
        .join(" ")}
    >
      {showAllTime ? (
        <button
          type="button"
          className={[
            "border px-3 py-2 text-[11.5px] transition-colors",
            preset === null
              ? "border-ink bg-ink text-milk"
              : "border-ink/12 bg-milk text-ink/55 hover:border-ink hover:text-ink",
          ].join(" ")}
          onClick={() => {
            void setParams({ range: null, from: null, to: null });
          }}
        >
          All time
        </button>
      ) : null}
      {TIME_RANGE_PRESETS.map((key) => (
        <button
          key={key}
          type="button"
          className={[
            "border px-3 py-2 text-[11.5px] transition-colors",
            preset === key
              ? "border-ink bg-ink text-milk"
              : "border-ink/12 bg-milk text-ink/55 hover:border-ink hover:text-ink",
          ].join(" ")}
          onClick={() => {
            void setParams({
              range: key as TimeRangePreset,
              ...(key === "custom"
                ? {}
                : { from: null, to: null }),
            });
          }}
        >
          {TIME_RANGE_LABELS[key]}
        </button>
      ))}
      {preset === "custom" ? (
        <span className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            className="border border-ink/12 bg-milk px-2 py-1.5 font-data text-[12px] text-ink outline-none focus:border-ink"
            value={params.from ?? ""}
            onChange={(e) => {
              void setParams({ from: e.target.value || null, range: "custom" });
            }}
          />
          <span className="text-[11px] text-ink/55">to</span>
          <input
            type="date"
            className="border border-ink/12 bg-milk px-2 py-1.5 font-data text-[12px] text-ink outline-none focus:border-ink"
            value={params.to ?? ""}
            onChange={(e) => {
              void setParams({ to: e.target.value || null, range: "custom" });
            }}
          />
        </span>
      ) : null}
    </div>
  );
}
