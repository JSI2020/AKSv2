import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import { PRODUCTION_JOB_STAGES } from "../constants";

export const productionBoardParsers = {
  stage: parseAsArrayOf(
    parseAsStringLiteral(PRODUCTION_JOB_STAGES),
  ).withDefault([]),
  staff: parseAsArrayOf(parseAsString).withDefault([]),
  atRisk: parseAsBoolean,
  sizeMode: parseAsArrayOf(
    parseAsStringLiteral(["STANDARD", "MADE_TO_MEASURE"] as const),
  ).withDefault([]),
  dateFrom: parseAsIsoDateTime,
  dateTo: parseAsIsoDateTime,
};

export const productionBoardSearchParamsCache = createSearchParamsCache(
  productionBoardParsers,
);

export type ProductionBoardFilters = {
  stage?: (typeof PRODUCTION_JOB_STAGES)[number][];
  staffId?: string[];
  atRisk?: boolean;
  sizeMode?: ("STANDARD" | "MADE_TO_MEASURE")[];
  dateFrom?: Date;
  dateTo?: Date;
};

export function searchParamsToProductionFilters(
  params: Awaited<
    ReturnType<typeof productionBoardSearchParamsCache.parse>
  >,
): ProductionBoardFilters {
  return {
    stage: params.stage.length > 0 ? params.stage : undefined,
    staffId: params.staff.length > 0 ? params.staff : undefined,
    atRisk: params.atRisk ?? undefined,
    sizeMode: params.sizeMode.length > 0 ? params.sizeMode : undefined,
    dateFrom: params.dateFrom ?? undefined,
    dateTo: params.dateTo ?? undefined,
  };
}
