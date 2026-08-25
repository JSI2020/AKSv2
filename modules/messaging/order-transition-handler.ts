import { eq } from "drizzle-orm";

import { db, messageLog, orders, users } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { enqueue } from "@/modules/platform/outbox/enqueue";
import type { OutboxHandler } from "@/modules/platform/outbox";

import { ORDER_STATUS_TEMPLATE_KEYS } from "./templates";

function resolveRecipient(input: {
  guestEmail: string | null;
  userEmail: string | null;
}): string | null {
  const email = input.userEmail?.trim() || input.guestEmail?.trim();
  if (!email || !email.includes("@")) return null;
  return email.toLowerCase();
}

function trackUrl(orderNumber: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";
  return `${base}/en/track/${encodeURIComponent(orderNumber)}`;
}

export type OrderTransitionedPayload = {
  entity: string;
  id: string;
  from: string;
  to: string;
  note?: string | null;
};

function isOrderTransitionedPayload(
  payload: Record<string, unknown>,
): payload is OrderTransitionedPayload {
  return (
    payload.entity === "order" &&
    typeof payload.id === "string" &&
    typeof payload.from === "string" &&
    typeof payload.to === "string"
  );
}

/** Enqueues a templated customer email for each order status change. */
export const handleOrderTransitioned: OutboxHandler = async (payload) => {
  if (!isOrderTransitionedPayload(payload)) {
    throw new Error("Invalid order.transitioned payload");
  }

  const templateKey = ORDER_STATUS_TEMPLATE_KEYS[payload.to];
  if (!templateKey) return;

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      guestEmail: orders.guestEmail,
      whatsappNumber: orders.whatsappNumber,
      userId: orders.userId,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
    })
    .from(orders)
    .where(eq(orders.id, payload.id))
    .limit(1);

  if (!order) return;

  const [user] = order.userId
    ? await db
        .select({ email: users.email, name: users.name })
        .from(users)
        .where(eq(users.id, order.userId))
        .limit(1)
    : [null];

  const customerName =
    user?.name ?? order.shippingAddressSnapshot.recipientName ?? "there";
  const vars = {
    orderNumber: order.orderNumber,
    customerName,
    trackUrl: trackUrl(order.orderNumber),
  };

  const emailRecipient = resolveRecipient({
    guestEmail: order.guestEmail,
    userEmail: user?.email ?? null,
  });

  await db.transaction(async (tx) => {
    if (emailRecipient) {
      const messageLogId = uuidv7();
      await tx.insert(messageLog).values({
        id: messageLogId,
        recipient: emailRecipient,
        templateKey,
        orderId: order.id,
        status: "PENDING",
      });
      await enqueue(
        "message.send",
        {
          messageLogId,
          recipient: emailRecipient,
          templateKey,
          locale: "en",
          vars,
          customerRemark: payload.note ?? null,
        },
        tx,
      );
    }

    // WhatsApp provider wires later — queue the intent with each stage change.
    const whatsapp = order.whatsappNumber?.replace(/\D/g, "") ?? "";
    if (whatsapp.length >= 10) {
      const waLogId = uuidv7();
      await tx.insert(messageLog).values({
        id: waLogId,
        recipient: whatsapp,
        templateKey: `whatsapp.${templateKey}`,
        orderId: order.id,
        status: "PENDING",
      });
      await enqueue(
        "whatsapp.notify",
        {
          messageLogId: waLogId,
          to: whatsapp,
          templateKey,
          orderId: order.id,
          orderNumber: order.orderNumber,
          customerName,
          note: payload.note ?? null,
          trackUrl: vars.trackUrl,
        },
        tx,
      );
    }
  });
};
