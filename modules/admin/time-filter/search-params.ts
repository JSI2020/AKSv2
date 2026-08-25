import {
  createSearchParamsCache,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { TIME_RANGE_PRESETS } from "./time-range";

/** Shared URL keys for analysis time filters. */
export const timeRangeParsers = {
  range: parseAsStringLiteral(TIME_RANGE_PRESETS).withDefault("month"),
  from: parseAsString,
  to: parseAsString,
};

export const timeRangeSearchParamsCache = createSearchParamsCache(
  timeRangeParsers,
);

/** Client/server parsers object for useQueryStates. */
export const timeRangeNuqsParsers = timeRangeParsers;
