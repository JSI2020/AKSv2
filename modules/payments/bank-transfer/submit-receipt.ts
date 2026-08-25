"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import {
  checkBankReceiptRateLimit,
  clientIpFromHeaders,
  logSignInAttempt,
} from "@/modules/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import {
  completeUpload,
  uploadKeyOwnedByPrefix,
} from "@/modules/platform/assets";

import { createBankTransferPaymentStandalone } from "./create-payment";

export async function submitBankTransferReceipt(input: {
  orderNumber: string;
  key: string;
  mime: string;
}): Promise<{ ok: true; paymentId: string } | { ok: false; error: string }> {
  if (!input.orderNumber.trim()) {
    return { ok: false, error: "Order number is required." };
  }
  if (!input.key.trim() || !input.mime.trim()) {
    return { ok: false, error: "Upload a receipt image first." };
  }
  if (!input.mime.startsWith("image/")) {
    return { ok: false, error: "Receipt must be an image." };
  }

  const hdrs = await headers();
  const ip = clientIpFromHeaders(hdrs);
  const orderNumber = input.orderNumber.trim();

  const rate = await checkBankReceiptRateLimit({ ip, orderNumber });
  if (!rate.ok) {
    await logSignInAttempt({
      email: `order:${orderNumber.toUpperCase()}`,
      ip,
      success: false,
      reason: "bank_receipt_rate",
    });
    return {
      ok: false,
      error: "Too many receipt uploads. Wait a bit and try again.",
    };
  }

  const session = await auth();
  const allowed: string[] = [];
  if (session?.user?.id) {
    allowed.push(`uploads/user/${session.user.id}`);
  }
  const anon = await getOrSetAnonToken();
  allowed.push(`uploads/anon/${anon}`);
  if (!uploadKeyOwnedByPrefix(input.key, allowed)) {
    await logSignInAttempt({
      email: `order:${orderNumber.toUpperCase()}`,
      ip,
      success: false,
      reason: "bank_receipt_bad_key",
    });
    return { ok: false, error: "Upload a receipt from this browser session." };
  }

  try {
    const asset = await completeUpload({
      key: input.key,
      mime: input.mime,
      kind: "IMAGE",
      uploadedById: session?.user?.id,
    });

    const { paymentId } = await createBankTransferPaymentStandalone({
      orderNumber,
      receiptAssetId: asset.id,
    });

    await logSignInAttempt({
      email: `order:${orderNumber.toUpperCase()}`,
      ip,
      success: true,
      reason: "bank_receipt_submit",
    });

    revalidatePath("/admin/payments/verification");
    revalidatePath("/admin/finance");
    return { ok: true, paymentId };
  } catch (error) {
    await logSignInAttempt({
      email: `order:${orderNumber.toUpperCase()}`,
      ip,
      success: false,
      reason: "bank_receipt_submit",
    });
    const message =
      error instanceof Error ? error.message : "Could not submit receipt.";
    return { ok: false, error: message };
  }
}
