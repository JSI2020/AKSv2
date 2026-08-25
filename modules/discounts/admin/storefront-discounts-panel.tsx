"use client";

import Link from "next/link";

import type { DiscountListRow } from "../queries";

/**
 * Lightweight view of automatic (no-code) discounts for storefront variables.
 * Full CRUD stays on /admin/discounts.
 */
export function StorefrontDiscountsPanel({
  rows,
}: {
  rows: DiscountListRow[];
}) {
  const automatic = rows.filter(
    (r) =>
      !r.code &&
      r.type === "PERCENTAGE" &&
      (r.appliesTo === "ORDER" ||
        r.appliesTo === "COLLECTION" ||
        r.appliesTo === "CATEGORY" ||
        r.appliesTo === "GARMENT_TYPE"),
  );

  return (
    <div className="space-y-4">
      <p className="max-w-xl text-[13px] text-ink/55">
        Overall or category percentage rules (no promo code). When a design has
        its own retail discount, that design discount takes priority on the
        product badge and selling price.
      </p>
      <Link
        href="/admin/discounts"
        className="inline-block border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
      >
        Manage discounts
      </Link>

      <ul className="divide-y divide-ink/10 border border-ink/12 bg-milk">
        {automatic.length === 0 ? (
          <li className="px-4 py-6 text-[13px] text-ink/45">
            No automatic site-wide or category discounts yet. Create a percentage
            discount without a code, scoped to Order, Collection, or Garment
            type.
          </li>
        ) : (
          automatic.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="text-[13px] text-ink">{r.name}</span>
              <span className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/40">
                {r.appliesTo.replace("_", " ")} · {r.value}% · {r.status}
              </span>
              {r.targetIds.length > 0 ? (
                <span className="font-data text-[11px] text-ink/40">
                  targets: {r.targetIds.join(", ")}
                </span>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
