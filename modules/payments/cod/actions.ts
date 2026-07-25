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

import { createCodRemittance } from "./queries";

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

export async function recordCodRemittanceAction(input: {
  courier: string;
  remittanceRef: string;
  expectedAmountMinor: number;
  receivedAmountMinor: number;
  receivedAt: string;
  orderIds: string[];
  discrepancyNote?: string;
}): Promise<{ ok: true; remittanceId: string } | { ok: false; error: string }> {
  try {
    const session = await requirePermission("money.manage_cod");

    if (!input.courier.trim() || !input.remittanceRef.trim()) {
      return { ok: false, error: "Courier and reference are required." };
    }
    if (input.expectedAmountMinor <= 0 || input.receivedAmountMinor < 0) {
      return { ok: false, error: "Enter valid amounts." };
    }

    const receivedAt = new Date(input.receivedAt);
    if (Number.isNaN(receivedAt.getTime())) {
      return { ok: false, error: "Enter a valid received date." };
    }

    const ctx = await auditContext();

    const remittanceId = await db.transaction(async (tx) => {
      const id = await createCodRemittance(
        {
          courier: input.courier,
          remittanceRef: input.remittanceRef,
          expectedAmountMinor: input.expectedAmountMinor,
          receivedAmountMinor: input.receivedAmountMinor,
          receivedAt,
          orderIds: input.orderIds,
          discrepancyNote: input.discrepancyNote,
          recordedById: session.user.id,
        },
        tx,
      );

      await insertAuditLog(tx as unknown as Database, {
        id: uuidv7(),
        actorId: session.user.id,
        actorRole: session.user.role,
        action: "payments.record_cod_remittance",
        entityType: "cod_remittance",
        entityId: id,
        before: null,
        after: {
          courier: input.courier.trim(),
          remittanceRef: input.remittanceRef.trim(),
          orderIds: input.orderIds,
        },
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });

      return id;
    });

    revalidatePath("/admin/payments/cod");
    return { ok: true, remittanceId };
  } catch (error) {
    return actionError(error);
  }
}
