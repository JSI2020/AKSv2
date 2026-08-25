/**
 * Shared shop-TZ time presets for admin analysis screens (Orders, Finance, etc.).
 * Asia/Karachi — same calendar as Overview.
 */

import {
  endOfShopDay,
  shopDateKey,
  startOfShopDay,
} from "@/modules/admin/today/overview-range";

export const TIME_RANGE_PRESETS = [
  "today",
  "7d",
  "month",
  "quarter",
  "year",
  "custom",
] as const;

export type TimeRangePreset = (typeof TIME_RANGE_PRESETS)[number];

export type ResolvedTimeRange = {
  preset: TimeRangePreset;
  from: Date;
  to: Date;
  fromKey: string;
  toKey: string;
};

function addDays(dateKey: string, days: number): string {
  const d = startOfShopDay(dateKey);
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  return shopDateKey(d);
}

function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

function startOfQuarterKey(dateKey: string): string {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(5, 7));
  const qStart = Math.floor((month - 1) / 3) * 3 + 1;
  return `${year}-${String(qStart).padStart(2, "0")}-01`;
}

function startOfYearKey(dateKey: string): string {
  return `${dateKey.slice(0, 4)}-01-01`;
}

/** Resolve a preset (+ optional custom keys) to inclusive shop-day bounds. */
export function resolveTimeRange(input: {
  preset?: string | null;
  fromKey?: string | null;
  toKey?: string | null;
  now?: Date;
}): ResolvedTimeRange {
  const now = input.now ?? new Date();
  const today = shopDateKey(now);
  const rawPreset = input.preset;
  const preset: TimeRangePreset =
    rawPreset &&
    (TIME_RANGE_PRESETS as readonly string[]).includes(rawPreset)
      ? (rawPreset as TimeRangePreset)
      : "month";

  let fromKey = today;
  let toKey = today;

  switch (preset) {
    case "today":
      fromKey = today;
      toKey = today;
      break;
    case "7d":
      fromKey = addDays(today, -6);
      toKey = today;
      break;
    case "month":
      fromKey = startOfMonthKey(today);
      toKey = today;
      break;
    case "quarter":
      fromKey = startOfQuarterKey(today);
      toKey = today;
      break;
    case "year":
      fromKey = startOfYearKey(today);
      toKey = today;
      break;
    case "custom": {
      const f =
        input.fromKey && /^\d{4}-\d{2}-\d{2}$/.test(input.fromKey)
          ? input.fromKey
          : startOfMonthKey(today);
      const t =
        input.toKey && /^\d{4}-\d{2}-\d{2}$/.test(input.toKey)
          ? input.toKey
          : today;
      fromKey = f <= t ? f : t;
      toKey = f <= t ? t : f;
      break;
    }
  }

  return {
    preset,
    from: startOfShopDay(fromKey),
    to: endOfShopDay(toKey),
    fromKey,
    toKey,
  };
}

export const TIME_RANGE_LABELS: Record<TimeRangePreset, string> = {
  today: "Today",
  "7d": "7 days",
  month: "This month",
  quarter: "This quarter",
  year: "This year",
  custom: "Custom range",
};
