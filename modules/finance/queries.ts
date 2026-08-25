import "server-only";

import { and, asc, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";

import {
  codRemittances,
  db,
  designCosts,
  expenditures,
  orderItems,
  orderPayments,
  orders,
  payments,
  users,
} from "@aks/db";

import { requirePermission, userHasPermission } from "@/modules/auth";
import type { ResolvedTimeRange } from "@/modules/admin/time-filter";
import {
  listAwaitingVerificationPayments,
} from "@/modules/payments/bank-transfer/queries";
import {
  derivePaymentStatus,
  type PaymentStatus,
} from "@/modules/orders/status";

import {
  categoryBreakdown,
  expandExpendituresForRange,
  sumExpandedMinor,
  sumRecurringExpandedMinor,
  type ExpenditureCategory,
  type ExpenditureRow,
} from "./expenditures-math";

function breakEvenMessage(
  recurringMinor: number,
  avgContributionPerOrderMinor: number,
  periodContributionMinor: number,
  orderCount: number,
): { ordersNeeded: number; message: string } {
  if (recurringMinor <= 0) {
    return {
      ordersNeeded: 0,
      message: "No recurring expenditure recorded yet.",
    };
  }
  if (avgContributionPerOrderMinor <= 0) {
    return {
      ordersNeeded: 0,
      message:
        "Contribution margin per order is not positive yet — check design costing.",
    };
  }
  const shortfall = recurringMinor - periodContributionMinor;
  if (shortfall <= 0) {
    return {
      ordersNeeded: 0,
      message: `You are above break-even this period (${orderCount} orders).`,
    };
  }
  const ordersNeeded = Math.ceil(shortfall / avgContributionPerOrderMinor);
  return {
    ordersNeeded,
    message: `About ${ordersNeeded} more order${ordersNeeded === 1 ? "" : "s"} covers your recurring costs.`,
  };
}

async function sumSucceededPaymentsInRange(
  kinds: ("DEPOSIT" | "BALANCE" | "FULL")[],
  from: Date,
  to: Date,
): Promise<number> {
  const [providerRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
    })
    .from(payments)
    .where(
      and(
        inArray(payments.kind, kinds),
        eq(payments.status, "SUCCEEDED"),
        gte(payments.createdAt, from),
        lte(payments.createdAt, to),
      ),
    );
  const [manualRow] = await db
    .select({
      total: sql<number>`coalesce(sum(${orderPayments.amountMinor}), 0)::int`,
    })
    .from(orderPayments)
    .where(
      and(
        inArray(orderPayments.kind, kinds),
        eq(orderPayments.status, "SUCCEEDED"),
        gte(orderPayments.createdAt, from),
        lte(orderPayments.createdAt, to),
      ),
    );
  return Number(providerRow?.total ?? 0) + Number(manualRow?.total ?? 0);
}

async function revenueInRange(from: Date, to: Date) {
  const [row] = await db
    .select({
      orderCount: sql<number>`count(*)::int`,
      revenueMinor: sql<number>`coalesce(sum(${orders.totalMinor}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.placedAt, from),
        lte(orders.placedAt, to),
        sql`${orders.status} not in ('DRAFT', 'CANCELLED', 'REFUNDED')`,
      ),
    );
  return {
    orderCount: Number(row?.orderCount ?? 0),
    revenueMinor: Number(row?.revenueMinor ?? 0),
  };
}

function remittedOrderIds(
  remittances: { orderIds: string[] }[],
): Set<string> {
  return new Set(remittances.flatMap((r) => r.orderIds));
}

export async function listExpendituresLedger(): Promise<ExpenditureRow[]> {
  await requirePermission("money.view");
  const rows = await db
    .select()
    .from(expenditures)
    .orderBy(desc(expenditures.date));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    category: r.category,
    payee: r.payee,
    amountMinor: r.amountMinor,
    paymentMethod: r.paymentMethod,
    isRecurring: r.isRecurring,
    recurrenceCycle: r.recurrenceCycle,
    endedAt: r.endedAt,
    note: r.note,
  }));
}

export type FinanceOrdersPaymentRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  userId: string | null;
  placedAt: Date | null;
  totalMinor: number;
  depositMinor: number;
  depositLabel: string;
  balanceMinor: number;
  balanceLabel: string;
  paymentStatus: PaymentStatus;
};

export async function listFinanceOrdersPayment(
  range: ResolvedTimeRange,
): Promise<{
  rows: FinanceOrdersPaymentRow[];
  collectedMinor: number;
  outstandingMinor: number;
  orderCount: number;
}> {
  await requirePermission("money.view");
  const { from, to } = range;

  const orderRows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      userId: orders.userId,
      placedAt: orders.placedAt,
      status: orders.status,
      totalMinor: orders.totalMinor,
      depositAmountMinor: orders.depositAmountMinor,
      balanceAmountMinor: orders.balanceAmountMinor,
      paymentPlan: orders.paymentPlan,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
      customerName: users.name,
    })
    .from(orders)
    .leftJoin(users, eq(users.id, orders.userId))
    .where(
      and(
        gte(orders.placedAt, from),
        lte(orders.placedAt, to),
        sql`${orders.status} not in ('DRAFT')`,
      ),
    )
    .orderBy(desc(orders.placedAt))
    .limit(200);

  const orderIds = orderRows.map((o) => o.id);
  const payRows =
    orderIds.length === 0
      ? []
      : await db
          .select()
          .from(payments)
          .where(inArray(payments.orderId, orderIds));

  const paysByOrder = new Map<string, typeof payRows>();
  for (const p of payRows) {
    const list = paysByOrder.get(p.orderId) ?? [];
    list.push(p);
    paysByOrder.set(p.orderId, list);
  }

  const collectedMinor = await sumSucceededPaymentsInRange(
    ["DEPOSIT", "BALANCE", "FULL"],
    from,
    to,
  );

  let outstandingMinor = 0;
  const rows: FinanceOrdersPaymentRow[] = orderRows.map((o) => {
    const pays = paysByOrder.get(o.id) ?? [];
    const paid = pays
      .filter((p) => p.status === "SUCCEEDED" || p.status === "REFUNDED")
      .reduce((s, p) => s + p.amountMinor, 0);
    const paymentStatus = derivePaymentStatus({
      status: o.status,
      paidMinor: paid,
      balanceAmountMinor: o.balanceAmountMinor,
      totalMinor: o.totalMinor,
    });
    if (
      paymentStatus === "AWAITING_DEPOSIT" ||
      paymentStatus === "BALANCE_DUE" ||
      paymentStatus === "DEPOSIT_PAID"
    ) {
      outstandingMinor += Math.max(0, o.totalMinor - paid);
    }

    const depositPay = pays.find(
      (p) =>
        (p.kind === "DEPOSIT" || p.kind === "FULL") &&
        (p.status === "SUCCEEDED" || p.status === "AWAITING_VERIFICATION"),
    );
    const depositLabel = !depositPay
      ? o.depositAmountMinor > 0
        ? "—"
        : "—"
      : [
          depositPay.kind === "FULL" ? "full" : String(depositPay.amountMinor),
          depositPay.provider === "BANK_TRANSFER"
            ? "bank"
            : depositPay.provider === "SAFEPAY"
              ? "Safepay"
              : depositPay.provider.toLowerCase(),
          depositPay.status === "SUCCEEDED" ? "✓" : "…",
        ].join(" · ");

    const balanceLabel =
      o.balanceAmountMinor <= 0
        ? "—"
        : paymentStatus === "REFUNDED"
          ? "refunded"
          : `${o.balanceAmountMinor} · COD`;

    const snap = o.shippingAddressSnapshot as { recipientName?: string } | null;

    return {
      id: o.id,
      orderNumber: o.orderNumber,
      customerName:
        o.customerName ?? snap?.recipientName ?? "Guest",
      userId: o.userId,
      placedAt: o.placedAt,
      totalMinor: o.totalMinor,
      depositMinor: o.depositAmountMinor,
      depositLabel,
      balanceMinor: o.balanceAmountMinor,
      balanceLabel,
      paymentStatus,
    };
  });

  return {
    rows,
    collectedMinor,
    outstandingMinor,
    orderCount: rows.length,
  };
}

export async function getFinanceOverview(range: ResolvedTimeRange) {
  await requirePermission("money.view");
  const { from, to } = range;
  const revenue = await revenueInRange(from, to);
  const collected = await sumSucceededPaymentsInRange(
    ["DEPOSIT", "BALANCE", "FULL"],
    from,
    to,
  );
  const outstanding = Math.max(0, revenue.revenueMinor - collected);

  const remittances = await db.select().from(codRemittances);
  const remitted = remittedOrderIds(remittances);

  const remittedInRange = remittances.filter(
    (r) => r.receivedAt >= from && r.receivedAt <= to,
  );
  const remittedMinor = remittedInRange.reduce(
    (s, r) => s + r.receivedAmountMinor,
    0,
  );

  const dispatched = await db
    .select({
      n: sql<number>`count(*)::int`,
      bal: sql<number>`coalesce(sum(${orders.balanceAmountMinor}), 0)::int`,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "DISPATCHED"),
        sql`${orders.balanceAmountMinor} > 0`,
      ),
    );

  const deliveredCod = await db
    .select({
      id: orders.id,
      balanceAmountMinor: orders.balanceAmountMinor,
    })
    .from(orders)
    .where(
      and(
        inArray(orders.status, ["DELIVERED", "COMPLETED"]),
        sql`${orders.balanceAmountMinor} > 0`,
      ),
    );
  const inTransit = deliveredCod.filter((o) => !remitted.has(o.id));
  const inTransitMinor = inTransit.reduce(
    (s, o) => s + o.balanceAmountMinor,
    0,
  );

  const [refused, placed] = await Promise.all([
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          eq(orders.status, "DELIVERY_REFUSED"),
          gte(orders.updatedAt, from),
          lte(orders.updatedAt, to),
        ),
      ),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(
        and(
          gte(orders.placedAt, from),
          lte(orders.placedAt, to),
          sql`${orders.status} not in ('DRAFT', 'CANCELLED')`,
        ),
      ),
  ]);
  const refusedN = Number(refused[0]?.n ?? 0);
  const placedN = Number(placed[0]?.n ?? 0);
  const refusalRatePercent =
    placedN > 0 ? Math.round((refusedN * 100) / placedN) : 0;

  const planRows = await db
    .select({
      plan: orders.paymentPlan,
      n: sql<number>`count(*)::int`,
    })
    .from(orders)
    .where(
      and(
        gte(orders.placedAt, from),
        lte(orders.placedAt, to),
        sql`${orders.status} not in ('DRAFT', 'CANCELLED')`,
      ),
    )
    .groupBy(orders.paymentPlan);

  let codBased = 0;
  let fullPrepay = 0;
  let bankFull = 0;
  for (const p of planRows) {
    const n = Number(p.n);
    if (p.plan === "FULL_PREPAID") fullPrepay += n;
    else codBased += n;
  }
  const methodTotal = codBased + fullPrepay + bankFull || 1;

  const payStatusCounts: Record<string, number> = {
    AWAITING_DEPOSIT: 0,
    BALANCE_DUE: 0,
    PAID: 0,
    REFUNDED: 0,
  };
  const ordPay = await listFinanceOrdersPayment(range);
  for (const r of ordPay.rows) {
    if (r.paymentStatus === "AWAITING_DEPOSIT") {
      payStatusCounts.AWAITING_DEPOSIT =
        (payStatusCounts.AWAITING_DEPOSIT ?? 0) + 1;
    } else if (
      r.paymentStatus === "BALANCE_DUE" ||
      r.paymentStatus === "DEPOSIT_PAID"
    ) {
      payStatusCounts.BALANCE_DUE = (payStatusCounts.BALANCE_DUE ?? 0) + 1;
    } else if (r.paymentStatus === "PAID") {
      payStatusCounts.PAID = (payStatusCounts.PAID ?? 0) + 1;
    } else if (r.paymentStatus === "REFUNDED") {
      payStatusCounts.REFUNDED = (payStatusCounts.REFUNDED ?? 0) + 1;
    }
  }

  // Weekly revenue buckets inside range
  const trend: { label: string; revenueMinor: number }[] = [];
  const cursor = new Date(from);
  let week = 1;
  while (cursor <= to && week <= 12) {
    const weekEnd = new Date(
      Math.min(cursor.getTime() + 7 * 86400000 - 1, to.getTime()),
    );
    const rev = await revenueInRange(cursor, weekEnd);
    trend.push({ label: `W${week}`, revenueMinor: rev.revenueMinor });
    cursor.setTime(cursor.getTime() + 7 * 86400000);
    week += 1;
  }

  return {
    revenueMinor: revenue.revenueMinor,
    outstandingMinor: outstanding,
    codInTransitMinor: inTransitMinor,
    refusalRatePercent,
    paymentMix: {
      codBasedPercent: Math.round((codBased * 100) / methodTotal),
      fullPrepayPercent: Math.round((fullPrepay * 100) / methodTotal),
      bankFullPercent: Math.round((bankFull * 100) / methodTotal),
    },
    trend,
    codFunnel: {
      outForDelivery: {
        count: Number(dispatched[0]?.n ?? 0),
        minor: Number(dispatched[0]?.bal ?? 0),
      },
      collectedNotRemitted: {
        count: inTransit.length,
        minor: inTransitMinor,
      },
      remitted: {
        count: remittedInRange.reduce((s, r) => s + r.orderIds.length, 0),
        minor: remittedMinor,
      },
    },
    payStatusCounts,
  };
}

export async function getFinanceMargin(range: ResolvedTimeRange) {
  const session = await requirePermission("money.view");
  const showMargin = await userHasPermission(
    session.user.id,
    "money.view_margin",
  );
  const { from, to } = range;
  const revenue = await revenueInRange(from, to);

  // Production costs: sum designCosts.totalCostMinor for items in range orders
  const costRows = await db
    .select({
      total: sql<number>`coalesce(sum(${designCosts.totalCostMinor} * ${orderItems.quantity}), 0)::int`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(designCosts, eq(designCosts.designId, orderItems.designId))
    .where(
      and(
        gte(orders.placedAt, from),
        lte(orders.placedAt, to),
        sql`${orders.status} not in ('DRAFT', 'CANCELLED', 'REFUNDED')`,
      ),
    );
  const productionCostMinor = Number(costRows[0]?.total ?? 0);

  const remits = await db
    .select()
    .from(codRemittances)
    .where(
      and(
        gte(codRemittances.receivedAt, from),
        lte(codRemittances.receivedAt, to),
      ),
    );
  const codFeeMinor = remits.reduce(
    (s, r) => s + Math.max(0, r.expectedAmountMinor - r.receivedAmountMinor),
    0,
  );

  const grossProfitMinor =
    revenue.revenueMinor - productionCostMinor - codFeeMinor;
  const grossMarginPercent =
    revenue.revenueMinor > 0
      ? Math.round((grossProfitMinor * 100) / revenue.revenueMinor)
      : 0;

  const ledger = await listExpendituresLedger();
  const expanded = expandExpendituresForRange(ledger, from, to);
  const operatingMinor = sumExpandedMinor(expanded);
  const recurringMinor = sumRecurringExpandedMinor(expanded);
  const oneOffMinor = operatingMinor - recurringMinor;
  const netProfitMinor = grossProfitMinor - operatingMinor;
  const netMarginPercent =
    revenue.revenueMinor > 0
      ? Math.round((netProfitMinor * 100) / revenue.revenueMinor)
      : 0;

  const avgContribution =
    revenue.orderCount > 0
      ? Math.round(grossProfitMinor / revenue.orderCount)
      : 0;
  const be = breakEvenMessage(
    recurringMinor,
    avgContribution,
    grossProfitMinor,
    revenue.orderCount,
  );

  return {
    showMargin,
    revenueMinor: revenue.revenueMinor,
    productionCostMinor,
    codFeeMinor,
    grossProfitMinor,
    grossMarginPercent,
    recurringExpenditureMinor: recurringMinor,
    oneOffExpenditureMinor: oneOffMinor,
    netProfitMinor,
    netMarginPercent,
    breakEvenMessage: be.message,
    ordersNeeded: be.ordersNeeded,
  };
}

export async function getExpenditureTabData(range: ResolvedTimeRange) {
  const ledger = await listExpendituresLedger();
  const expanded = expandExpendituresForRange(ledger, range.from, range.to);
  return {
    ledger,
    expanded,
    totalMinor: sumExpandedMinor(expanded),
    byCategory: categoryBreakdown(expanded),
  };
}

export async function getFinanceHubData(range: ResolvedTimeRange) {
  const [
    overview,
    ordersPayment,
    expenditure,
    remittances,
    verification,
    margin,
  ] = await Promise.all([
    getFinanceOverview(range),
    listFinanceOrdersPayment(range),
    getExpenditureTabData(range),
    db
      .select()
      .from(codRemittances)
      .where(
        and(
          gte(codRemittances.receivedAt, range.from),
          lte(codRemittances.receivedAt, range.to),
        ),
      )
      .orderBy(desc(codRemittances.receivedAt)),
    listAwaitingVerificationPayments().catch(() => []),
    getFinanceMargin(range),
  ]);

  return {
    overview,
    ordersPayment,
    expenditure,
    remittances: remittances.map((r) => ({
      id: r.id,
      courier: r.courier,
      remittanceRef: r.remittanceRef,
      expectedAmountMinor: r.expectedAmountMinor,
      receivedAmountMinor: r.receivedAmountMinor,
      receivedAt: r.receivedAt,
      orderIds: r.orderIds,
      perOrderExpected: r.perOrderExpected ?? {},
      discrepancyNote: r.discrepancyNote,
      hasDiscrepancy: r.expectedAmountMinor !== r.receivedAmountMinor,
      shortfallMinor: Math.max(
        0,
        r.expectedAmountMinor - r.receivedAmountMinor,
      ),
    })),
    verification,
    margin,
  };
}

export type { ExpenditureCategory };
