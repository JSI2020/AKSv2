/**
 * Pure merge helpers — reassignment planning + LTV recompute (unit-tested).
 */

export type MergeOrderInput = {
  id: string;
  userId: string | null;
  whatsappNumber: string;
  totalMinor: number;
};

export type MergeReassignmentPlan = {
  orderIdsToSurvivor: string[];
  whatsappNumbersMoved: string[];
  survivorOrderCount: number;
  survivorLifetimeValueMinor: number;
};

/** Reassign loser's orders (by userId and/or guest WhatsApp) onto survivor. */
export function planMergeOrderReassignment(input: {
  survivorUserId: string;
  loserUserId: string | null;
  loserWhatsappDigits: string | null;
  orders: MergeOrderInput[];
  normalizePhone: (raw: string) => string;
}): MergeReassignmentPlan {
  const {
    survivorUserId,
    loserUserId,
    loserWhatsappDigits,
    orders,
    normalizePhone,
  } = input;

  const loserWa = loserWhatsappDigits
    ? normalizePhone(loserWhatsappDigits)
    : null;

  const moved = new Set<string>();
  const whatsapps = new Set<string>();

  for (const order of orders) {
    const byUser = loserUserId != null && order.userId === loserUserId;
    const byWa =
      loserWa != null &&
      loserWa.length >= 10 &&
      normalizePhone(order.whatsappNumber) === loserWa;
    if (byUser || byWa) {
      moved.add(order.id);
      whatsapps.add(normalizePhone(order.whatsappNumber));
    }
  }

  // After merge: all survivor userId orders + moved
  const postMerge = orders.filter(
    (o) => o.userId === survivorUserId || moved.has(o.id),
  );

  const stats = recomputeLifetimeStats(postMerge.map((o) => o.totalMinor));

  return {
    orderIdsToSurvivor: [...moved],
    whatsappNumbersMoved: [...whatsapps],
    survivorOrderCount: stats.totalOrdersCount,
    survivorLifetimeValueMinor: stats.lifetimeValueMinor,
  };
}

export function recomputeLifetimeStats(totalsMinor: number[]): {
  totalOrdersCount: number;
  lifetimeValueMinor: number;
} {
  return {
    totalOrdersCount: totalsMinor.length,
    lifetimeValueMinor: totalsMinor.reduce((s, n) => s + n, 0),
  };
}

/** Count Hamming-1 phone pairs among unique digit strings (same length only). */
export function countHammingOnePairs(
  phones: string[],
  normalizePhone: (raw: string) => string,
  hamming: (a: string, b: string) => number,
): number {
  const unique = [
    ...new Set(
      phones
        .map(normalizePhone)
        .filter((d) => d.length >= 10),
    ),
  ];
  let pairs = 0;
  for (let i = 0; i < unique.length; i++) {
    for (let j = i + 1; j < unique.length; j++) {
      if (hamming(unique[i]!, unique[j]!) === 1) pairs++;
    }
  }
  return pairs;
}
