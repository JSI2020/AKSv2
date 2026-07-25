"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { db, insertAuditLog, type Database } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  clientIpFromHeaders,
  PermissionDeniedError,
  requirePermission,
} from "@/modules/auth";

import {
  applyRejectedBankTransfer,
  applyVerifiedBankTransfer,
} from "./verify-core";

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
  if (error instanceof Error) {
    return { ok: false, error: error.message };
  }
  return { ok: false, error: "Something went wrong." };
}

export async function verifyBankTransferAction(
  paymentId: string,
): Promise<{ ok: true; orderNumber: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("money.verify_payments");
    const ctx = await auditContext();

    const result = await db.transaction(async (tx) => {
      const verified = await applyVerifiedBankTransfer(
        {
          paymentId,
          verifiedById: session.user.id,
          verifiedByRole: session.user.role,
        },
        tx,
      );

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "payments.verify_bank_transfer",
        entityType: "payment",
        entityId: paymentId,
        before: { status: "AWAITING_VERIFICATION" },
        after: { status: "SUCCEEDED", orderId: verified.orderId },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return verified;
    });

    revalidatePath("/admin/payments/verification");
    revalidatePath("/admin/orders");
    revalidatePath(`/admin/orders/${result.orderId}`);
    return { ok: true, orderNumber: result.orderNumber };
  } catch (error) {
    return actionError(error);
  }
}

export async function rejectBankTransferAction(input: {
  paymentId: string;
  reason: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("money.verify_payments");
    if (!input.reason.trim()) {
      return { ok: false, error: "Enter a reason for rejection." };
    }

    const ctx = await auditContext();

    await db.transaction(async (tx) => {
      const rejected = await applyRejectedBankTransfer(
        {
          paymentId: input.paymentId,
          reason: input.reason,
          rejectedById: session.user.id,
        },
        tx,
      );

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "payments.reject_bank_transfer",
        entityType: "payment",
        entityId: input.paymentId,
        before: { status: "AWAITING_VERIFICATION" },
        after: {
          status: "FAILED",
          reason: input.reason.trim(),
          orderId: rejected.orderId,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    });

    revalidatePath("/admin/payments/verification");
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
