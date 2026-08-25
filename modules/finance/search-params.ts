import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { TIME_RANGE_PRESETS } from "@/modules/admin/time-filter";

export const FINANCE_TABS = [
  "overview",
  "orders",
  "expenditure",
  "cod",
  "verify",
  "margin",
] as const;

export type FinanceTab = (typeof FINANCE_TABS)[number];

export const financeSearchParams = {
  tab: parseAsStringLiteral(FINANCE_TABS).withDefault("overview"),
  range: parseAsStringLiteral(TIME_RANGE_PRESETS).withDefault("month"),
  from: parseAsString,
  to: parseAsString,
  payStatus: parseAsString.withDefault("all"),
};

export const financeSearchParamsCache =
  createSearchParamsCache(financeSearchParams);
