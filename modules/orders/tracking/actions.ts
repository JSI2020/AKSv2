"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db, orders, users } from "@aks/db";
import {
  grantTrackAccess,
  issueTrackOtp,
  verifyTrackOtp,
} from "@/modules/messaging";

import { orderContactMatches } from "./lookup-match";

const LOOKUP_MISS = "We couldn't find an order with those details.";

export async function lookupOrderAction(input: {
  orderNumber: string;
  email: string;
  phone: string;
}): Promise<{ ok: true; href: string } | { ok: false; error: string }> {
  const orderNumber = input.orderNumber.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  if (!orderNumber || (!email && !phone)) {
    return {
      ok: false,
      error: "Enter the order number and the email or phone from the order.",
    };
  }

  const [order] = await db
    .select()
    .from(orders)
    .where(eq(orders.orderNumber, orderNumber))
    .limit(1);
  if (!order) return { ok: false, error: LOOKUP_MISS };

  let accountEmail: string | null = null;
  let accountPhone: string | null = null;
  if (order.userId) {
    const [user] = await db
      .select({ email: users.email, phone: users.phone })
      .from(users)
      .where(eq(users.id, order.userId))
      .limit(1);
    accountEmail = user?.email ?? null;
    accountPhone = user?.phone ?? null;
  }

  const address = order.shippingAddressSnapshot;
  const matched = orderContactMatches({
    email,
    phone,
    orderEmails: [order.guestEmail, accountEmail],
    orderPhones: [
      order.guestPhone,
      order.whatsappNumber,
      address.phone,
      address.whatsappNumber,
      accountPhone,
    ],
  });
  if (!matched) return { ok: false, error: LOOKUP_MISS };

  await grantTrackAccess({
    orderNumber: order.orderNumber,
    email: email || order.guestEmail || accountEmail || "phone-lookup@aks-atelier.com",
  });

  return {
    ok: true,
    href: `/track/${encodeURIComponent(order.orderNumber)}`,
  };
}

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
