import {
  createSearchParamsCache,
  parseAsArrayOf,
  parseAsBoolean,
  parseAsInteger,
  parseAsIsoDateTime,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs/server";

import {
  PAYMENT_STATUS_FILTER_VALUES,
  PRODUCTION_STATUS_FILTER_VALUES,
} from "../status";

export const ORDER_SOURCE_VALUES = [
  "WEB",
  "WHATSAPP",
  "INSTAGRAM",
  "PHONE",
  "WALK_IN",
] as const;

export const ORDER_SIZE_MODE_VALUES = ["STANDARD", "MADE_TO_MEASURE"] as const;

export const orderListParsers = {
  q: parseAsString,
  production: parseAsArrayOf(
    parseAsStringLiteral(PRODUCTION_STATUS_FILTER_VALUES),
  ).withDefault([]),
  payment: parseAsArrayOf(
    parseAsStringLiteral(PAYMENT_STATUS_FILTER_VALUES),
  ).withDefault([]),
  source: parseAsArrayOf(parseAsStringLiteral(ORDER_SOURCE_VALUES)).withDefault(
    [],
  ),
  sizeMode: parseAsArrayOf(
    parseAsStringLiteral(ORDER_SIZE_MODE_VALUES),
  ).withDefault([]),
  atRisk: parseAsBoolean,
  dateFrom: parseAsIsoDateTime,
  dateTo: parseAsIsoDateTime,
  page: parseAsInteger.withDefault(1),
  perPage: parseAsInteger.withDefault(25),
  view: parseAsString,
};

export const orderListSearchParamsCache = createSearchParamsCache(
  orderListParsers,
);

export function searchParamsToOrderFilters(
  params: Awaited<ReturnType<typeof orderListSearchParamsCache.parse>>,
) {
  return {
    q: params.q ?? undefined,
    productionStatus:
      params.production.length > 0 ? params.production : undefined,
    paymentStatus: params.payment.length > 0 ? params.payment : undefined,
    source: params.source.length > 0 ? params.source : undefined,
    sizeMode: params.sizeMode.length > 0 ? params.sizeMode : undefined,
    atRisk: params.atRisk ?? undefined,
    dateFrom: params.dateFrom ?? undefined,
    dateTo: params.dateTo ?? undefined,
    page: params.page,
    perPage: params.perPage,
  };
}
