import { sql } from "@aks/db";

/**
 * Rank designs by paid order_items over a trailing window.
 * Paid only — refused COD / unpaid placements do not count.
 *
 * Commerce tables arrive in Step 29. Until then this returns [] so the
 * best-sellers collection is honestly empty rather than hand-tagged.
 */
export async function getPaidSalesRanking(
  windowDays = 90,
): Promise<{ designId: string; units: number }[]> {
  const present = await sql<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = 'order_items'
    ) AS present
  `;

  const row = present[0];
  if (!row?.present) {
    return [];
  }

  // Full paid ranking — activated once order_items + payments exist (Step 29+).
  // Requires: order_items.design_id, orders with a paid deposit/full payment.
  try {
    const ranked = await sql<{ design_id: string; units: number }[]>`
      SELECT oi.design_id, SUM(oi.quantity)::int AS units
      FROM order_items oi
      INNER JOIN orders o ON o.id = oi.order_id
      WHERE o.placed_at >= NOW() - (${windowDays}::text || ' days')::interval
        AND o.status NOT IN ('DRAFT', 'CANCELLED', 'AWAITING_DEPOSIT')
        AND (
          EXISTS (
            SELECT 1 FROM payments p
            WHERE p.order_id = o.id
              AND p.kind IN ('DEPOSIT', 'FULL', 'BALANCE')
              AND p.status = 'SUCCEEDED'
          )
          OR o.status IN (
            'DEPOSIT_PAID',
            'MEASUREMENTS_CONFIRMED',
            'IN_PRODUCTION',
            'QUALITY_CHECK',
            'READY_TO_SHIP',
            'DISPATCHED',
            'DELIVERED',
            'COMPLETED'
          )
        )
      GROUP BY oi.design_id
      ORDER BY units DESC
    `;
    return ranked.map((r) => ({
      designId: r.design_id,
      units: r.units,
    }));
  } catch {
    // Schema mid-migration — treat as no paid sales.
    return [];
  }
}
