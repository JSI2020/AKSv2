/** Shop calendar helpers for Overview date range (Asia/Karachi). */

const SHOP_TIME_ZONE = "Asia/Karachi";

export type OverviewRange = {
  /** Inclusive start (00:00:00 PKT). */
  from: Date;
  /** Inclusive end (23:59:59.999 PKT). */
  to: Date;
  /** YYYY-MM-DD in shop TZ for form controls. */
  fromKey: string;
  /** YYYY-MM-DD in shop TZ for form controls. */
  toKey: string;
};

export function shopDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SHOP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Midnight PKT for a YYYY-MM-DD shop calendar day. */
export function startOfShopDay(dateKey: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) {
    return startOfShopDay(shopDateKey());
  }
  return new Date(`${dateKey}T00:00:00+05:00`);
}

export function endOfShopDay(dateKey: string): Date {
  const start = startOfShopDay(dateKey);
  return new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export function startOfTodayInShop(now = new Date()): Date {
  return startOfShopDay(shopDateKey(now));
}

export function endOfTodayInShop(now = new Date()): Date {
  return endOfShopDay(shopDateKey(now));
}

/**
 * Parse ?from=&to= (YYYY-MM-DD). Defaults to today in shop TZ.
 * Swaps if from > to.
 */
export function parseOverviewRange(input: {
  from?: string | string[] | undefined;
  to?: string | string[] | undefined;
}): OverviewRange {
  const today = shopDateKey();
  const rawFrom = Array.isArray(input.from) ? input.from[0] : input.from;
  const rawTo = Array.isArray(input.to) ? input.to[0] : input.to;

  let fromKey =
    rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : today;
  let toKey = rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : today;

  if (fromKey > toKey) {
    const tmp = fromKey;
    fromKey = toKey;
    toKey = tmp;
  }

  return {
    from: startOfShopDay(fromKey),
    to: endOfShopDay(toKey),
    fromKey,
    toKey,
  };
}
