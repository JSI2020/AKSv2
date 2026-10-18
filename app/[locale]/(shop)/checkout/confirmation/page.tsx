import { Link } from "@/i18n/routing";
import { Money } from "@/modules/ui";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";
import { isOnlinePrepaidEnabled } from "@/modules/payments/methods-config";
import {
  paymentStatusLabel,
  productionStageLabel,
} from "@/modules/orders/status";
import type { OrderStatus } from "@/modules/orders/constants";
import { db, orders, payments } from "@aks/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function CheckoutConfirmationPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderNumber = params.order?.trim() ?? "";
  const onlineEnabled = isOnlinePrepaidEnabled();

  const [order] = orderNumber
    ? await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          status: orders.status,
          totalMinor: orders.totalMinor,
          depositAmountMinor: orders.depositAmountMinor,
          balanceAmountMinor: orders.balanceAmountMinor,
          paymentPlan: orders.paymentPlan,
          guestEmail: orders.guestEmail,
        })
        .from(orders)
        .where(eq(orders.orderNumber, orderNumber))
        .limit(1)
    : [];

  const [paidRow] = order
    ? await db
        .select({
          total: sql<number>`coalesce(sum(${payments.amountMinor}), 0)`,
        })
        .from(payments)
        .where(
          and(
            eq(payments.orderId, order.id),
            inArray(payments.status, ["SUCCEEDED", "REFUNDED"]),
            notInArray(payments.kind, ["REFUND"]),
          ),
        )
    : [];
  const paidMinor = Number(paidRow?.total ?? 0);
  const paymentLabel = order
    ? paymentStatusLabel({
        status: order.status as OrderStatus,
        balanceAmountMinor: order.balanceAmountMinor,
        paidMinor,
        totalMinor: order.totalMinor,
        paymentPlan: order.paymentPlan,
      })
    : null;

  const awaitingOnlinePay =
    order?.status === "AWAITING_DEPOSIT" && onlineEnabled;
  const codConfirmed =
    order?.paymentPlan === "FULL_COD" ||
    (order &&
      order.depositAmountMinor === 0 &&
      order.balanceAmountMinor > 0 &&
      order.status !== "AWAITING_DEPOSIT" &&
      order.status !== "DRAFT" &&
      order.status !== "CANCELLED");
  const depositPaid =
    order &&
    order.status !== "AWAITING_DEPOSIT" &&
    order.status !== "DRAFT" &&
    order.status !== "CANCELLED";

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-12">
        <h1 className="font-display text-[28px] font-medium text-ink">
          {order ? "It's begun" : "Order confirmation"}
        </h1>

        {!orderNumber ? (
          <p className="mt-3 text-[16px] leading-relaxed text-ink/75">
            No order number on this page. If you just placed an order, open the
            link from your confirmation or track it from your email.
          </p>
        ) : !order ? (
          <p className="mt-3 text-[16px] leading-relaxed text-ink/75">
            We could not find order {orderNumber}. Check the number, or message
            us on WhatsApp and we will sort it.
          </p>
        ) : (
          <>
            <p className="mt-3 text-[16px] leading-relaxed text-ink/75">
              {awaitingOnlinePay
                ? "Your order is saved. Pay online in full to begin — we cut and stitch after that."
                : codConfirmed
                  ? "Your order is confirmed. Pay the full amount in cash when it arrives."
                  : depositPaid
                    ? "Payment received. We will keep you posted as your piece moves through the workshop."
                    : "We have your order. Track it any time below."}
            </p>

            <dl className="mt-6 space-y-2 border border-ink/15 px-4 py-4 text-[14px]">
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Order</dt>
                <dd className="font-data text-ink">{order.orderNumber}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Status</dt>
                <dd className="text-ink">
                  {productionStageLabel(order.status as OrderStatus)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Payment</dt>
                <dd className="text-ink">{paymentLabel}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink/55">Total</dt>
                <dd>
                  <Money value={order.totalMinor} />
                </dd>
              </div>
              {order.depositAmountMinor > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">Pay now</dt>
                  <dd>
                    <Money value={order.depositAmountMinor} />
                  </dd>
                </div>
              ) : null}
              {order.balanceAmountMinor > 0 ? (
                <div className="flex justify-between gap-4">
                  <dt className="text-ink/55">
                    {order.depositAmountMinor > 0
                      ? "Balance"
                      : "Pay on delivery"}
                  </dt>
                  <dd>
                    <Money value={order.balanceAmountMinor} />
                  </dd>
                </div>
              ) : null}
            </dl>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/track/${encodeURIComponent(order.orderNumber)}`}
                className="inline-block border border-ink px-4 py-3 text-center text-[12px] uppercase tracking-[0.08em] text-ink"
              >
                Track your order
              </Link>
              {awaitingOnlinePay ? (
                <Link
                  href={`/checkout/pay?order=${encodeURIComponent(order.orderNumber)}`}
                  className="inline-block border border-ink bg-ink px-4 py-3 text-center text-[12px] uppercase tracking-[0.08em] text-greige"
                >
                  Pay online
                </Link>
              ) : null}
            </div>

            {order.guestEmail ? (
              <p className="mt-4 text-[13px] text-ink/60">
                Updates go to {order.guestEmail}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </ShopPageContainer>
  );
}
