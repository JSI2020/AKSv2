"use server";

import { revalidatePath } from "next/cache";

import {
  grantTrackAccess,
  issueTrackOtp,
  verifyTrackOtp,
} from "@/modules/messaging";

export async function requestTrackOtpAction(input: {
  orderNumber: string;
  email: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await issueTrackOtp(input);
  if (!result.ok) return result;
  return { ok: true };
}

export async function verifyTrackOtpAction(input: {
  orderNumber: string;
  email: string;
  code: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const valid = await verifyTrackOtp(input);
  if (!valid) {
    return { ok: false, error: "That code didn't work. Try again." };
  }

  await grantTrackAccess({
    orderNumber: input.orderNumber,
    email: input.email,
  });

  revalidatePath(`/track/${input.orderNumber}`);
  return { ok: true };
}
