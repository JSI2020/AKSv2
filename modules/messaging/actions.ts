"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db, messageLog, orders } from "@aks/db";

import { requirePermission } from "@/modules/auth";
import { enqueue } from "@/modules/platform/outbox/enqueue";

import { seedMessageTemplatesIntoDb } from "./seed-templates";

async function buildRetryPayload(row: typeof messageLog.$inferSelect) {
  if (!row.orderId) {
    return {
      recipient: row.recipient,
      templateKey: row.templateKey,
      locale: "en" as const,
      vars: {} as Record<string, string>,
    };
  }

  const [order] = await db
    .select({
      orderNumber: orders.orderNumber,
      shippingAddressSnapshot: orders.shippingAddressSnapshot,
    })
    .from(orders)
    .where(eq(orders.id, row.orderId))
    .limit(1);

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "http://localhost:3000";

  return {
    recipient: row.recipient,
    templateKey: row.templateKey,
    locale: "en" as const,
    vars: {
      orderNumber: order?.orderNumber ?? "",
      customerName: order?.shippingAddressSnapshot.recipientName ?? "there",
      trackUrl: order
        ? `${base}/en/track/${encodeURIComponent(order.orderNumber)}`
        : base,
    },
  };
}

export async function listOrderMessages(orderId: string) {
  await requirePermission("orders.view");
  return db
    .select()
    .from(messageLog)
    .where(eq(messageLog.orderId, orderId))
    .orderBy(desc(messageLog.createdAt));
}

export async function retryMessageAction(
  messageLogId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requirePermission("orders.edit");

    const [row] = await db
      .select()
      .from(messageLog)
      .where(eq(messageLog.id, messageLogId))
      .limit(1);

    if (!row) return { ok: false, error: "Message not found." };
    if (row.status !== "FAILED" && row.status !== "DEAD") {
      return { ok: false, error: "Only failed messages can be retried." };
    }

    await db.transaction(async (tx) => {
      const payload = await buildRetryPayload(row);

      await tx
        .update(messageLog)
        .set({ status: "PENDING", error: null })
        .where(eq(messageLog.id, messageLogId));

      await enqueue(
        "message.send",
        {
          messageLogId: row.id,
          ...payload,
        },
        tx,
      );
    });

    if (row.orderId) {
      revalidatePath(`/admin/orders/${row.orderId}`);
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not retry message." };
  }
}

export async function seedMessageTemplates(): Promise<void> {
  await requirePermission("settings.edit");
  await seedMessageTemplatesIntoDb();
}
