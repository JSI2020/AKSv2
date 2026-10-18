import { and, eq, isNull, ne } from "drizzle-orm";

import {
  accounts,
  addresses,
  customerProfiles,
  db,
  insertAuditLog,
  users,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  consumeEmailOtp,
  normalizeEmail,
  verifyEmailOtp,
} from "@/modules/auth/otp";
import { isHousePlaceholderEmail } from "@/modules/auth/social/identity";

import { canClearPhone, canDisconnectProvider } from "./methods";
import {
  validateAccountEmail,
  validateAccountPhone,
  validateDisplayName,
  validateSavedAddress,
  type SavedAddressInput,
} from "./profile-input";

export type AccountAddress = {
  id: string;
  label: string | null;
  recipientName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  landmark: string | null;
  isDefault: boolean;
};

export type AccountSnapshot = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  placeholderEmail: boolean;
  providers: string[];
  addresses: AccountAddress[];
};

async function audit(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
): Promise<void> {
  await insertAuditLog(db, {
    id: uuidv7(),
    actorId: userId,
    actorRole: "CUSTOMER",
    action,
    entityType,
    entityId,
    after: { ok: true },
  });
}

export async function loadAccountSnapshot(
  userId: string,
): Promise<AccountSnapshot | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      role: users.role,
      deletedAt: users.deletedAt,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (
    !user ||
    user.role !== "CUSTOMER" ||
    user.deletedAt ||
    user.status === "DISABLED"
  ) {
    return null;
  }

  const providerRows = await db
    .select({ provider: accounts.provider })
    .from(accounts)
    .where(eq(accounts.userId, userId));
  const addressRows = await db
    .select({
      id: addresses.id,
      label: addresses.label,
      recipientName: addresses.recipientName,
      phone: addresses.phone,
      addressLine1: addresses.addressLine1,
      addressLine2: addresses.addressLine2,
      city: addresses.city,
      province: addresses.province,
      postalCode: addresses.postalCode,
      landmark: addresses.landmark,
      isDefault: addresses.isDefaultShipping,
    })
    .from(addresses)
    .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)));

  const placeholderEmail = isHousePlaceholderEmail(user.email);
  return {
    id: user.id,
    name: user.name,
    email: placeholderEmail ? null : user.email,
    phone: user.phone,
    placeholderEmail,
    providers: providerRows.map((row) => row.provider),
    addresses: addressRows,
  };
}

async function inventory(userId: string) {
  const snapshot = await loadAccountSnapshot(userId);
  if (!snapshot) return null;
  const [user] = await db
    .select({ email: users.email, phone: users.phone })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    snapshot,
    methods: {
      email: user?.email ?? null,
      phone: user?.phone ?? snapshot.phone,
      providers: snapshot.providers,
    },
  };
}

export async function updateCustomerName(
  userId: string,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = validateDisplayName(raw);
  if (!parsed.ok) return parsed;
  const current = await loadAccountSnapshot(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  const now = new Date();
  await db
    .update(users)
    .set({ name: parsed.name, updatedAt: now })
    .where(eq(users.id, userId));
  await audit(userId, "customer.name_update", "user", userId);
  return { ok: true };
}

export async function updateCustomerPhone(
  userId: string,
  raw: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = validateAccountPhone(raw);
  if (!parsed.ok) return parsed;
  const current = await inventory(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  if (parsed.phone === null && !canClearPhone(current.methods)) {
    return {
      ok: false,
      error: "Add an email or another sign-in before removing this number.",
    };
  }
  const now = new Date();
  await db
    .update(users)
    .set({ phone: parsed.phone, updatedAt: now })
    .where(eq(users.id, userId));
  const [profile] = await db
    .select({ userId: customerProfiles.userId })
    .from(customerProfiles)
    .where(eq(customerProfiles.userId, userId))
    .limit(1);
  if (profile) {
    await db
      .update(customerProfiles)
      .set({ whatsappNumber: parsed.phone, updatedAt: now })
      .where(eq(customerProfiles.userId, userId));
  }
  await audit(userId, "customer.phone_update", "user", userId);
  return { ok: true };
}

export async function assertEmailAvailable(
  userId: string,
  email: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const [taken] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!taken || taken.id === userId) return { ok: true };
  if (taken.role !== "CUSTOMER") {
    return { ok: false, error: "That email can't be used here." };
  }
  return { ok: false, error: "That email already has an account." };
}

export async function confirmCustomerEmail(
  userId: string,
  rawEmail: string,
  code: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = validateAccountEmail(rawEmail);
  if (!parsed.ok) return parsed;
  const current = await loadAccountSnapshot(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  const available = await assertEmailAvailable(userId, parsed.email);
  if (!available.ok) return available;
  const valid = await verifyEmailOtp({ email: parsed.email, code });
  if (!valid) return { ok: false, error: "That code didn't work." };
  const now = new Date();
  await db
    .update(users)
    .set({
      email: normalizeEmail(parsed.email),
      emailVerified: now,
      updatedAt: now,
    })
    .where(eq(users.id, userId));
  await consumeEmailOtp(parsed.email);
  await audit(userId, "customer.email_update", "user", userId);
  return { ok: true };
}

export async function saveCustomerAddress(
  userId: string,
  input: SavedAddressInput,
  addressId?: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const parsed = validateSavedAddress(input);
  if (!parsed.ok) return parsed;
  const current = await loadAccountSnapshot(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  const now = new Date();
  const id = addressId ?? uuidv7();
  const makeDefault = parsed.data.isDefault || current.addresses.length === 0;

  if (addressId) {
    const owned = current.addresses.some((row) => row.id === addressId);
    if (!owned)
      return { ok: false, error: "That address is not on this account." };
  }

  if (makeDefault) {
    await db
      .update(addresses)
      .set({ isDefaultShipping: false, updatedAt: now })
      .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)));
  }

  const values = {
    label: parsed.data.label,
    recipientName: parsed.data.recipientName,
    phone: parsed.data.phone,
    addressLine1: parsed.data.addressLine1,
    addressLine2: parsed.data.addressLine2,
    city: parsed.data.city,
    province: parsed.data.province,
    postalCode: parsed.data.postalCode,
    landmark: parsed.data.landmark,
    isDefaultShipping: makeDefault,
    updatedAt: now,
  };

  if (addressId) {
    await db.update(addresses).set(values).where(eq(addresses.id, addressId));
  } else {
    await db.insert(addresses).values({
      id,
      userId,
      ...values,
      createdAt: now,
    });
  }
  await audit(userId, "customer.address_save", "address", id);
  return { ok: true, id };
}

export async function removeCustomerAddress(
  userId: string,
  addressId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await loadAccountSnapshot(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  const row = current.addresses.find((item) => item.id === addressId);
  if (!row) return { ok: false, error: "That address is not on this account." };
  const now = new Date();
  await db
    .update(addresses)
    .set({ deletedAt: now, isDefaultShipping: false, updatedAt: now })
    .where(and(eq(addresses.id, addressId), eq(addresses.userId, userId)));
  if (row.isDefault) {
    const [next] = await db
      .select({ id: addresses.id })
      .from(addresses)
      .where(
        and(
          eq(addresses.userId, userId),
          isNull(addresses.deletedAt),
          ne(addresses.id, addressId),
        ),
      )
      .limit(1);
    if (next) {
      await db
        .update(addresses)
        .set({ isDefaultShipping: true, updatedAt: now })
        .where(eq(addresses.id, next.id));
    }
  }
  await audit(userId, "customer.address_remove", "address", addressId);
  return { ok: true };
}

export async function disconnectCustomerProvider(
  userId: string,
  provider: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const current = await inventory(userId);
  if (!current) return { ok: false, error: "Sign in again." };
  if (!canDisconnectProvider(current.methods, provider)) {
    return {
      ok: false,
      error: "Keep at least one way to sign in before removing this one.",
    };
  }
  await db
    .delete(accounts)
    .where(and(eq(accounts.userId, userId), eq(accounts.provider, provider)));
  await audit(userId, "customer.provider_disconnect", "account", provider);
  return { ok: true };
}
