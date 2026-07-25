import type { PermissionKey } from "@aks/shared";

import { can } from "@/modules/auth";

export type TodayActionCounts = {
  awaitingConfirmation: number;
  measurementsUnverified: number;
  atRisk: number;
  balanceDue: number;
  lowStock: number;
  bankTransfer: number;
  designsReview: number;
};

export type TodayActionCard = {
  id: string;
  label: string;
  hint?: string;
  count: number;
  href: string;
};

export function buildTodayActionCards(
  granted: ReadonlySet<string>,
  counts: TodayActionCounts,
): TodayActionCard[] {
  const cards: TodayActionCard[] = [];

  if (can(granted, "orders.view")) {
    cards.push(
      {
        id: "awaiting-confirmation",
        label: "Orders awaiting confirmation",
        count: counts.awaitingConfirmation,
        href: "/admin/orders?production=RECEIVED",
      },
      {
        id: "measurements-unverified",
        label: "Measurements not verified",
        hint: "Blocks cutting",
        count: counts.measurementsUnverified,
        href: "/admin/orders?production=CONFIRMED",
      },
      {
        id: "at-risk",
        label: "Orders at risk",
        hint: "Past or nearing promised date",
        count: counts.atRisk,
        href: "/admin/orders?atRisk=true",
      },
      {
        id: "balance-due",
        label: "Balance payments outstanding",
        count: counts.balanceDue,
        href: "/admin/orders?payment=BALANCE_DUE",
      },
    );
  }

  if (can(granted, "fabric.view")) {
    cards.push({
      id: "low-stock",
      label: "Fabric below reorder point",
      count: counts.lowStock,
      href: "/admin/fabrics?lowStock=true",
    });
  }

  if (can(granted, "money.verify_payments")) {
    cards.push({
      id: "bank-transfer",
      label: "Bank transfers to verify",
      count: counts.bankTransfer,
      href: "/admin/payments/verification",
    });
  }

  if (can(granted, "designs.view")) {
    cards.push({
      id: "designs-review",
      label: "Designs awaiting review or publish",
      count: counts.designsReview,
      href: "/admin/designs?awaitingReview=true",
    });
  }

  return cards;
}

export function emptyTodayActionCounts(): TodayActionCounts {
  return {
    awaitingConfirmation: 0,
    measurementsUnverified: 0,
    atRisk: 0,
    balanceDue: 0,
    lowStock: 0,
    bankTransfer: 0,
    designsReview: 0,
  };
}

/** @internal for tests */
export function ownerPermissionSet(): Set<PermissionKey> {
  return new Set<PermissionKey>([
    "orders.view",
    "fabric.view",
    "money.verify_payments",
    "designs.view",
    "money.view",
  ]);
}
