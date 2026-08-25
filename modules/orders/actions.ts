"use server";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import {
  db,
  insertAuditLog,
  orderPayments,
  orderPhotos,
  orders,
  type Database,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  clientIpFromHeaders,
  PermissionDeniedError,
  requirePermission,
} from "@/modules/auth";
import { computeDepositAmounts } from "@/modules/checkout/payment-plans";
import { completeUpload } from "@/modules/platform/assets";

import { cancelOrder, OrderCancelError } from "./cancel-order";
import type { OrderStatus } from "./constants";
import {
  cancelReasonLabel,
  priceAdjustmentReasonLabel,
} from "./reason-codes";
import { orderRequiresEmbroidery } from "./embroidery";
import { getNextProductionStage, isBeforeProductionLock } from "./status";
import { transitionOrder } from "./transition-order";
import { ORDER_TRANSITION_ALLOW } from "./transitions";
import { recordCodBalanceOnDelivery } from "@/modules/payments/cod/queries";
import { handleDeliveryRefused } from "@/modules/payments/cod/customer-profile";
import { consumeFabricAtCutting } from "@/modules/inventory";

import "./transitions";

async function auditContext() {
  const h = await headers();
  return {
    ip: clientIpFromHeaders(h),
    userAgent: h.get("user-agent")?.slice(0, 512) ?? null,
  };
}

function actionError(error: unknown): { ok: false; error: string } {
  if (error instanceof PermissionDeniedError) {
    return { ok: false, error: "You do not have permission for this action." };
  }
  if (error instanceof OrderCancelError) {
    return { ok: false, error: error.message };
  }
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong." };
}

export async function confirmMeasurementsAction(
  orderId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.advance_status");
    const ctx = await auditContext();

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");
      const from = order.status as OrderStatus;
      if (from !== "DEPOSIT_PAID") {
        throw new Error(
          "Measurements can only be confirmed after the deposit is received.",
        );
      }

      const requiresEmbroidery = await orderRequiresEmbroidery(orderId, tx);

      await transitionOrder({
        orderId,
        from,
        to: "MEASUREMENTS_CONFIRMED",
        actor: { id: session.user.id, role: session.user.role },
        note: "Measurements confirmed",
        tx,
      });

      await tx
        .update(orders)
        .set({ skipEmbroidery: !requiresEmbroidery, updatedAt: new Date() })
        .where(eq(orders.id, orderId));

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.confirm_measurements",
        entityType: "order",
        entityId: orderId,
        before: { status: from },
        after: { status: "MEASUREMENTS_CONFIRMED" },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function advanceStageAction(input: {
  orderId: string;
  customerRemark?: string;
  /** Hundredths of a metre per order item — required when advancing to CUTTING. */
  actualMetersByOrderItemId?: Record<string, number>;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.advance_status");
    const customerRemark = input.customerRemark?.trim() || undefined;
    let orderNumber: string | null = null;

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          status: orders.status,
          userId: orders.userId,
          balanceAmountMinor: orders.balanceAmountMinor,
          skipEmbroidery: orders.skipEmbroidery,
          orderNumber: orders.orderNumber,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");
      orderNumber = order.orderNumber;
      const from = order.status as OrderStatus;
      const to = getNextProductionStage(from, order.skipEmbroidery);
      if (!to) {
        throw new Error(`No next stage from ${from}.`);
      }

      await transitionOrder({
        orderId: input.orderId,
        from,
        to,
        actor: { id: session.user.id, role: session.user.role },
        note: customerRemark,
        tx,
      });

      if (to === "CUTTING") {
        await consumeFabricAtCutting(
          {
            orderId: input.orderId,
            actor: { id: session.user.id, role: session.user.role },
            actualMetersByOrderItemId: input.actualMetersByOrderItemId,
          },
          tx,
        );
      }

      if (to === "DELIVERED" && order.balanceAmountMinor > 0) {
        await recordCodBalanceOnDelivery(
          input.orderId,
          session.user.id,
          tx,
        );
      }

      if (to === "DELIVERY_REFUSED" && order.userId) {
        await handleDeliveryRefused(
          order.userId,
          input.orderId,
          session.user.id,
          tx,
        );
      }

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.advance_stage",
        entityType: "order",
        entityId: input.orderId,
        before: { status: from },
        after: { status: to, customerRemark },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    if (orderNumber) {
      revalidatePath(`/account/orders/${orderNumber}`);
      revalidatePath(`/track/${orderNumber}`);
    }
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function recordPaymentAction(input: {
  orderId: string;
  amountMinor: number;
  provider: string;
  kind: "DEPOSIT" | "BALANCE" | "FULL";
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.edit");
    if (input.amountMinor <= 0) {
      return { ok: false, error: "Amount must be greater than zero." };
    }

    const provider = input.provider as
      | "BANK_TRANSFER"
      | "CASH"
      | "JAZZCASH"
      | "EASYPAISA"
      | "COD"
      | "SAFEPAY"
      | "OTHER";

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");

      await tx.insert(orderPayments).values({
        id: uuidv7(),
        orderId: input.orderId,
        kind: input.kind,
        amountMinor: input.amountMinor,
        provider,
        status: "SUCCEEDED",
        note: input.note?.trim() || null,
        recordedById: session.user.id,
      });

      const paidRows = await tx
        .select({
          amountMinor: orderPayments.amountMinor,
          status: orderPayments.status,
          kind: orderPayments.kind,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, input.orderId));
      const paidTotal = paidRows
        .filter((p) => p.status === "SUCCEEDED" && p.kind !== "REFUND")
        .reduce((s, p) => s + p.amountMinor, 0);
      const balanceAmountMinor = Math.max(0, order.totalMinor - paidTotal);
      await tx
        .update(orders)
        .set({ balanceAmountMinor, updatedAt: new Date() })
        .where(eq(orders.id, input.orderId));

      const from = order.status as OrderStatus;
      if (from === "AWAITING_DEPOSIT" && input.kind !== "BALANCE") {
        await transitionOrder({
          orderId: input.orderId,
          from,
          to: "DEPOSIT_PAID",
          actor: { id: session.user.id, role: session.user.role },
          note: input.note?.trim() || "Deposit recorded",
          tx,
        });
      }

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.record_payment",
        entityType: "order",
        entityId: input.orderId,
        before: { status: from },
        after: {
          payment: {
            kind: input.kind,
            amountMinor: input.amountMinor,
            provider,
          },
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Edit planned deposit amount; optionally mark deposit as paid
 * (records payment + advances AWAITING_DEPOSIT → DEPOSIT_PAID).
 */
export async function updateDepositAction(input: {
  orderId: string;
  depositAmountMinor: number;
  markDepositPaid?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = input.markDepositPaid
      ? await requirePermission("orders.advance_status").catch(async () =>
          requirePermission("orders.edit"),
        )
      : await requirePermission("orders.edit");
    if (
      !Number.isInteger(input.depositAmountMinor) ||
      input.depositAmountMinor < 0
    ) {
      return { ok: false, error: "Enter a valid deposit amount." };
    }

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);
      if (!order) throw new Error("Order not found.");
      if (input.depositAmountMinor > order.totalMinor) {
        throw new Error("Deposit cannot exceed order total.");
      }

      const paidRows = await tx
        .select({
          amountMinor: orderPayments.amountMinor,
          status: orderPayments.status,
          kind: orderPayments.kind,
        })
        .from(orderPayments)
        .where(eq(orderPayments.orderId, input.orderId));
      let paidTotal = paidRows
        .filter((p) => p.status === "SUCCEEDED" && p.kind !== "REFUND")
        .reduce((s, p) => s + p.amountMinor, 0);

      const from = order.status as OrderStatus;
      if (input.markDepositPaid) {
        const alreadyDeposited = paidTotal >= input.depositAmountMinor;
        if (!alreadyDeposited && input.depositAmountMinor > 0) {
          const remaining = input.depositAmountMinor - paidTotal;
          if (remaining > 0) {
            await tx.insert(orderPayments).values({
              id: uuidv7(),
              orderId: input.orderId,
              kind: "DEPOSIT",
              amountMinor: remaining,
              provider: "BANK_TRANSFER",
              status: "SUCCEEDED",
              note: "Deposit marked paid",
              recordedById: session.user.id,
            });
            paidTotal += remaining;
          }
        }
        if (from === "AWAITING_DEPOSIT") {
          await transitionOrder({
            orderId: input.orderId,
            from,
            to: "DEPOSIT_PAID",
            actor: { id: session.user.id, role: session.user.role },
            note: "Deposit marked paid",
            tx,
          });
        }
      }

      // Balance due = total − amount actually paid (never treat unpaid deposit as settled).
      const balanceAmountMinor = Math.max(0, order.totalMinor - paidTotal);

      await tx
        .update(orders)
        .set({
          depositAmountMinor: input.depositAmountMinor,
          balanceAmountMinor,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.update_deposit",
        entityType: "order",
        entityId: input.orderId,
        before: {
          depositAmountMinor: order.depositAmountMinor,
          balanceAmountMinor: order.balanceAmountMinor,
          status: from,
        },
        after: {
          depositAmountMinor: input.depositAmountMinor,
          balanceAmountMinor,
          paidTotal,
          markDepositPaid: Boolean(input.markDepositPaid),
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function refundOrderAction(
  orderId: string,
  note?: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.refund");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");
      const from = order.status as OrderStatus;

      if (from === "REFUND_PENDING") {
        await transitionOrder({
          orderId,
          from,
          to: "REFUNDED",
          actor: { id: session.user.id, role: session.user.role },
          note: note?.trim() || "Refund completed",
          tx,
        });
      } else {
        const allowed = ORDER_TRANSITION_ALLOW[from] ?? [];
        if (!allowed.includes("REFUND_PENDING")) {
          throw new Error(`Order in status ${from} cannot be refunded.`);
        }
        await transitionOrder({
          orderId,
          from,
          to: "REFUND_PENDING",
          actor: { id: session.user.id, role: session.user.role },
          note: note?.trim() || "Refund initiated",
          tx,
        });
      }

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.refund",
        entityType: "order",
        entityId: orderId,
        before: { status: from },
        after: {
          status: from === "REFUND_PENDING" ? "REFUNDED" : "REFUND_PENDING",
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function cancelOrderAction(input: {
  orderId: string;
  reasonCode: string;
  note?: string;
  acknowledgeDepositForfeit?: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.cancel");
    const reason = [
      cancelReasonLabel(input.reasonCode),
      input.note?.trim(),
    ]
      .filter(Boolean)
      .join(" — ");

    await db.transaction(async (tx) => {
      const [before] = await tx
        .select({ status: orders.status })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      await cancelOrder({
        orderId: input.orderId,
        reason,
        actor: { id: session.user.id, role: session.user.role },
        acknowledgeDepositForfeit: input.acknowledgeDepositForfeit,
        tx,
      });

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.cancel",
        entityType: "order",
        entityId: input.orderId,
        before: before ? { status: before.status } : null,
        after: { reasonCode: input.reasonCode, reason },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateOrderNotesAction(input: {
  orderId: string;
  customerNotes?: string;
  internalNotes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.edit");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select({
          status: orders.status,
          customerNotes: orders.customerNotes,
          internalNotes: orders.internalNotes,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");

      await tx
        .update(orders)
        .set({
          customerNotes:
            input.customerNotes !== undefined
              ? input.customerNotes.trim() || null
              : order.customerNotes,
          internalNotes:
            input.internalNotes !== undefined
              ? input.internalNotes.trim() || null
              : order.internalNotes,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.update_notes",
        entityType: "order",
        entityId: input.orderId,
        before: {
          customerNotes: order.customerNotes,
          internalNotes: order.internalNotes,
        },
        after: {
          customerNotes:
            input.customerNotes !== undefined
              ? input.customerNotes.trim() || null
              : order.customerNotes,
          internalNotes:
            input.internalNotes !== undefined
              ? input.internalNotes.trim() || null
              : order.internalNotes,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function editOrderBeforeLockAction(input: {
  orderId: string;
  whatsappNumber?: string;
  customerNotes?: string;
  internalNotes?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.edit");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");
      if (!isBeforeProductionLock(order.status as OrderStatus)) {
        throw new Error(
          "This order is locked — editing is only allowed before measurements are confirmed.",
        );
      }

      const patch: Partial<typeof orders.$inferInsert> = {
        updatedAt: new Date(),
      };
      if (input.whatsappNumber !== undefined) {
        const digits = input.whatsappNumber.replace(/\D/g, "");
        if (digits.length < 10) {
          throw new Error("Enter a valid WhatsApp number.");
        }
        patch.whatsappNumber = digits;
      }
      if (input.customerNotes !== undefined) {
        patch.customerNotes = input.customerNotes.trim() || null;
      }
      if (input.internalNotes !== undefined) {
        patch.internalNotes = input.internalNotes.trim() || null;
      }

      await tx.update(orders).set(patch).where(eq(orders.id, input.orderId));

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.edit_before_lock",
        entityType: "order",
        entityId: input.orderId,
        before: {
          whatsappNumber: order.whatsappNumber,
          customerNotes: order.customerNotes,
          internalNotes: order.internalNotes,
        },
        after: patch,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function adjustOrderPriceAction(input: {
  orderId: string;
  newTotalMinor: number;
  reasonCode: string;
  note?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.edit");
    if (input.newTotalMinor <= 0) {
      return { ok: false, error: "Total must be greater than zero." };
    }

    const reasonLabel = priceAdjustmentReasonLabel(input.reasonCode);
    const reason = [reasonLabel, input.note?.trim()].filter(Boolean).join(" — ");

    await db.transaction(async (tx) => {
      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1);

      if (!order) throw new Error("Order not found.");

      const { depositAmountMinor, balanceAmountMinor } = computeDepositAmounts({
        totalMinor: input.newTotalMinor,
        plan: order.paymentPlan,
      });

      await tx
        .update(orders)
        .set({
          subtotalMinor: input.newTotalMinor - order.shippingMinor + order.discountMinor - order.taxMinor,
          totalMinor: input.newTotalMinor,
          depositAmountMinor,
          balanceAmountMinor,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, input.orderId));

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.adjust_price",
        entityType: "order",
        entityId: input.orderId,
        before: {
          totalMinor: order.totalMinor,
          depositAmountMinor: order.depositAmountMinor,
          balanceAmountMinor: order.balanceAmountMinor,
        },
        after: {
          totalMinor: input.newTotalMinor,
          depositAmountMinor,
          balanceAmountMinor,
          reasonCode: input.reasonCode,
          reason,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

export async function uploadOrderPhotoAction(input: {
  orderId: string;
  key: string;
  mime: string;
  stage: string;
  isCustomerVisible: boolean;
}): Promise<{ ok: true; photoId: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("orders.edit");
    if (!input.stage.trim()) {
      return { ok: false, error: "Select a production stage." };
    }

    const asset = await completeUpload({
      key: input.key,
      mime: input.mime,
      uploadedById: session.user.id,
      kind: "IMAGE",
    });

    const photoId = uuidv7();

    await db.transaction(async (tx) => {
      await tx.insert(orderPhotos).values({
        id: photoId,
        orderId: input.orderId,
        stage: input.stage.trim(),
        assetId: asset.id,
        isCustomerVisible: input.isCustomerVisible,
        uploadedById: session.user.id,
      });

      const ctx = await auditContext();
      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "orders.upload_photo",
        entityType: "order",
        entityId: input.orderId,
        before: null,
        after: {
          photoId,
          stage: input.stage.trim(),
          isCustomerVisible: input.isCustomerVisible,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath(`/admin/orders/${input.orderId}`);
    return { ok: true, photoId };
  } catch (error) {
    return actionError(error);
  }
}

/** Guard check for UI — STAFF cannot refund. */
export async function canRefundOrders(): Promise<boolean> {
  try {
    await requirePermission("orders.refund");
    return true;
  } catch {
    return false;
  }
}
