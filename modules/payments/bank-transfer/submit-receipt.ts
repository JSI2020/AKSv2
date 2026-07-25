"use server";

import { revalidatePath } from "next/cache";

import { completeUpload } from "@/modules/platform/assets";

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

  try {
    const asset = await completeUpload({
      key: input.key,
      mime: input.mime,
      kind: "IMAGE",
    });

    const { paymentId } = await createBankTransferPaymentStandalone({
      orderNumber: input.orderNumber,
      receiptAssetId: asset.id,
    });

    revalidatePath("/admin/payments/verification");
    return { ok: true, paymentId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not submit receipt.";
    return { ok: false, error: message };
  }
}

export {
  applyVerifiedBankTransfer,
  applyRejectedBankTransfer,
  CHECKOUT_GUEST_ACTOR_ID,
} from "./verify-core";
