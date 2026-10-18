"use server";

import { cookies } from "next/headers";

import { auth } from "@/auth";
import { issueEmailOtp } from "@/modules/auth/otp";
import { eraseCustomerById } from "@/modules/legal/erase-customer";

import {
  oauthLinkExpiresAt,
  OAUTH_LINK_COOKIE,
  signOAuthLinkCookie,
} from "./oauth-link";
import {
  confirmCustomerEmail,
  disconnectCustomerProvider,
  removeCustomerAddress,
  saveCustomerAddress,
  updateCustomerName,
  updateCustomerPhone,
  assertEmailAvailable,
} from "./profile-store";
import {
  validateAccountEmail,
  validateDeleteConfirmation,
  type SavedAddressInput,
} from "./profile-input";

export type AccountActionResult =
  { ok: true; devCode?: string } | { ok: false; error: string };

async function customerId(): Promise<
  { ok: true; userId: string } | { ok: false; error: string }
> {
  const session = await auth();
  const userId = session?.user?.id;
  const role = session?.user?.role;
  if (!userId || (role && role !== "CUSTOMER")) {
    return { ok: false, error: "Sign in again." };
  }
  return { ok: true, userId };
}

export async function updateNameAction(
  name: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  return updateCustomerName(session.userId, name);
}

export async function updatePhoneAction(
  phone: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  return updateCustomerPhone(session.userId, phone);
}

export async function requestEmailChangeAction(
  email: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  const parsed = validateAccountEmail(email);
  if (!parsed.ok) return parsed;
  const available = await assertEmailAvailable(session.userId, parsed.email);
  if (!available.ok) return available;
  const issued = await issueEmailOtp({ email: parsed.email });
  return { ok: true, devCode: issued.devCode };
}

export async function confirmEmailChangeAction(
  email: string,
  code: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  return confirmCustomerEmail(session.userId, email, code);
}

export async function saveAddressAction(
  input: SavedAddressInput,
  addressId?: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  const saved = await saveCustomerAddress(session.userId, input, addressId);
  if (!saved.ok) return saved;
  return { ok: true };
}

export async function removeAddressAction(
  addressId: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  return removeCustomerAddress(session.userId, addressId);
}

export async function disconnectProviderAction(
  provider: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  return disconnectCustomerProvider(session.userId, provider);
}

export async function beginOAuthLinkAction(): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  const secret = process.env.AUTH_SECRET?.trim() ?? "";
  if (!secret) {
    return { ok: false, error: "Sign-in linking is not configured." };
  }
  const value = signOAuthLinkCookie(
    session.userId,
    secret,
    oauthLinkExpiresAt(),
  );
  const jar = await cookies();
  jar.set(OAUTH_LINK_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return { ok: true };
}

export async function deleteOwnAccountAction(
  confirmation: string,
): Promise<AccountActionResult> {
  const session = await customerId();
  if (!session.ok) return session;
  const confirmed = validateDeleteConfirmation(confirmation);
  if (!confirmed.ok) return confirmed;
  const erased = await eraseCustomerById(session.userId, "self");
  if (erased !== "erased") {
    return { ok: false, error: "This account can't be deleted here." };
  }
  return { ok: true };
}
