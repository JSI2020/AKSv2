import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  db,
  orderEvents,
  orders,
  outbox,
  payments,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { ensureOrdersSchema } from "@/modules/orders/test-setup";
import "@/modules/orders/transitions";

import { processSafepayWebhook } from "./handle-webhook";
import { signSafepayWebhook } from "./providers/safepay";
import { ensurePaymentsSchema } from "./test-setup";

const TEST_WEBHOOK_SECRET = Buffer.from("aks-step32-test-secret").toString(
  "base64",
);

const SHIPPING_SNAPSHOT = {
  recipientName: "Safepay Customer",
  phone: "+923001234567",
  whatsappNumber: "+923001234567",
  addressLine1: "12 Mall Road",
  addressLine2: null,
  city: "Lahore",
  province: "PUNJAB" as const,
  postalCode: null,
  landmark: null,
};

function buildWebhookPayload(input: {
  orderNumber: string;
  amountMinor: number;
  providerRef: string;
}) {
  return JSON.stringify({
    api_version: "v1",
    data: {
      payment: {
        token: input.providerRef,
        order_id: input.orderNumber,
        amount: String(input.amountMinor),
        status: "P_SETTLED",
        request_id: uuidv7(),
      },
    },
  });
}

async function insertAwaitingDepositOrder(input: {
  orderNumber: string;
  depositAmountMinor: number;
  totalMinor: number;
}) {
  const orderId = uuidv7();
  await db.insert(orders).values({
    id: orderId,
    orderNumber: input.orderNumber,
    whatsappNumber: "+923001234567",
    status: "AWAITING_DEPOSIT",
    subtotalMinor: input.totalMinor,
    discountMinor: 0,
    shippingMinor: 0,
    taxMinor: 0,
    totalMinor: input.totalMinor,
    depositAmountMinor: input.depositAmountMinor,
    balanceAmountMinor: input.totalMinor - input.depositAmountMinor,
    paymentPlan: "DEPOSIT_50_COD_50",
    shippingAddressSnapshot: SHIPPING_SNAPSHOT,
    source: "WEB",
    placedAt: new Date(),
  });
  return { orderId, orderNumber: input.orderNumber };
}

describe("Safepay webhook idempotency", () => {
  beforeAll(async () => {
    process.env.SAFEPAY_BASE_URL = "https://api.getsafepay.com/raastwire";
    process.env.SAFEPAY_AGGREGATOR_ID = "agg_test";
    process.env.SAFEPAY_SECRET_KEY = "sk_test";
    process.env.SAFEPAY_AGGREGATOR_MERCHANT_IDENTIFIER = "am_test";
    process.env.SAFEPAY_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;

    await ensureOrdersSchema();
    await ensurePaymentsSchema();
  });

  beforeEach(async () => {
    await db.delete(outbox);
    await db.delete(payments);
    await db.delete(orderEvents);
    await db.delete(orders);
  });

  afterAll(async () => {
    delete process.env.SAFEPAY_BASE_URL;
    delete process.env.SAFEPAY_AGGREGATOR_ID;
    delete process.env.SAFEPAY_SECRET_KEY;
    delete process.env.SAFEPAY_AGGREGATOR_MERCHANT_IDENTIFIER;
    delete process.env.SAFEPAY_WEBHOOK_SECRET;
  });

  it("transitions deposit to DEPOSIT_PAID and dedupes five webhook replays", async () => {
    const orderNumber = `AKS-TEST-${uuidv7().slice(0, 8)}`;
    const depositAmountMinor = 25_000_00;
    const totalMinor = 50_000_00;
    const { orderId } = await insertAwaitingDepositOrder({
      orderNumber,
      depositAmountMinor,
      totalMinor,
    });

    const eventId = `evt_${uuidv7()}`;
    const timestamp = new Date().toISOString();
    const providerRef = `pm_${uuidv7()}`;
    const rawBody = buildWebhookPayload({
      orderNumber,
      amountMinor: depositAmountMinor,
      providerRef,
    });
    const signature = signSafepayWebhook({
      secretBase64: TEST_WEBHOOK_SECRET,
      rawBody,
      timestamp,
    });

    const context = {
      timestamp,
      eventId,
      eventType: "payment.completed",
    };

    const results = [];
    for (let i = 0; i < 5; i += 1) {
      results.push(
        await processSafepayWebhook({
          rawBody,
          signature,
          context,
        }),
      );
    }

    expect(results[0]).toEqual({
      duplicate: false,
      processed: true,
      orderId,
    });
    expect(results.slice(1).every((r) => r.duplicate && !r.processed)).toBe(
      true,
    );

    const paymentRows = await db
      .select()
      .from(payments)
      .where(eq(payments.orderId, orderId));
    expect(paymentRows).toHaveLength(1);
    expect(paymentRows[0]?.idempotencyKey).toBe(eventId);
    expect(paymentRows[0]?.provider).toBe("SAFEPAY");
    expect(paymentRows[0]?.kind).toBe("DEPOSIT");
    expect(paymentRows[0]?.amountMinor).toBe(depositAmountMinor);
    expect(paymentRows[0]?.status).toBe("SUCCEEDED");

    const [order] = await db
      .select({ status: orders.status })
      .from(orders)
      .where(eq(orders.id, orderId))
      .limit(1);
    expect(order?.status).toBe("DEPOSIT_PAID");

    const transitions = await db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.entityId, orderId));
    const depositTransitions = transitions.filter(
      (e) =>
        e.fromStatus === "AWAITING_DEPOSIT" && e.toStatus === "DEPOSIT_PAID",
    );
    expect(depositTransitions).toHaveLength(1);

    const outboxRows = await db
      .select()
      .from(outbox)
      .where(eq(outbox.topic, "payment.succeeded"));
    expect(outboxRows).toHaveLength(1);
  });
});
