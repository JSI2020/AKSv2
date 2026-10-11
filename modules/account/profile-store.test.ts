import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import {
  accounts,
  addresses,
  auditLogs,
  db,
  users,
  verificationTokens,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { hashOtp } from "@/modules/auth/otp";
import { eraseCustomerById } from "@/modules/legal/erase-customer";

import {
  confirmCustomerEmail,
  disconnectCustomerProvider,
  loadAccountSnapshot,
  saveCustomerAddress,
  updateCustomerName,
  updateCustomerPhone,
} from "./profile-store";

const created: string[] = [];

async function makeCustomer(email: string, phone: string | null = null) {
  const id = uuidv7();
  created.push(id);
  await db.insert(users).values({
    id,
    email,
    name: "Before",
    phone,
    role: "CUSTOMER",
    status: "ACTIVE",
  });
  return id;
}

afterAll(async () => {
  for (const id of created) {
    await db.delete(auditLogs).where(eq(auditLogs.entityId, id));
    await db.delete(auditLogs).where(eq(auditLogs.actorId, id));
    await db.delete(accounts).where(eq(accounts.userId, id));
    await db.delete(addresses).where(eq(addresses.userId, id));
    await db.delete(users).where(eq(users.id, id));
  }
});

describe("customer profile store", () => {
  it("updates name and phone and refuses a bad address", async () => {
    const id = await makeCustomer(
      `acct-${uuidv7()}@example.com`,
      "923001112233",
    );
    expect((await updateCustomerName(id, "Amina Khan")).ok).toBe(true);
    expect((await updateCustomerPhone(id, "03007654321")).ok).toBe(true);
    const snap = await loadAccountSnapshot(id);
    expect(snap?.name).toBe("Amina Khan");
    expect(snap?.phone).toBe("03007654321");

    const saved = await saveCustomerAddress(id, {
      recipientName: "Amina Khan",
      phone: "03007654321",
      addressLine1: "12 Canal Bank",
      city: "Lahore",
      province: "PUNJAB",
      isDefault: true,
    });
    expect(saved.ok).toBe(true);
    const withAddress = await loadAccountSnapshot(id);
    expect(withAddress?.addresses).toHaveLength(1);
    expect(withAddress?.addresses[0]?.city).toBe("Lahore");

    const bad = await saveCustomerAddress(id, {
      recipientName: "Amina Khan",
      phone: "03007654321",
      addressLine1: "12 Canal Bank",
      city: "Lahore",
      province: "BERLIN",
    });
    expect(bad.ok).toBe(false);
  });

  it("confirms an email code and keeps the last sign-in method", async () => {
    const id = await makeCustomer(`fb.${uuidv7()}@customers.aks.local`);
    const nextEmail = `next-${uuidv7()}@example.com`;
    await db.insert(verificationTokens).values({
      identifier: nextEmail,
      token: hashOtp("123456"),
      expires: new Date(Date.now() + 60_000),
    });
    expect((await confirmCustomerEmail(id, nextEmail, "000000")).ok).toBe(
      false,
    );
    expect((await confirmCustomerEmail(id, nextEmail, "123456")).ok).toBe(true);
    const snap = await loadAccountSnapshot(id);
    expect(snap?.email).toBe(nextEmail);

    await db.insert(accounts).values({
      id: uuidv7(),
      userId: id,
      type: "oauth",
      provider: "facebook",
      providerAccountId: `fb-${id}`,
    });
    expect((await disconnectCustomerProvider(id, "facebook")).ok).toBe(true);
    expect((await loadAccountSnapshot(id))?.providers).not.toContain(
      "facebook",
    );
  });

  it("anonymises the customer and linked providers on delete", async () => {
    const id = await makeCustomer(
      `gone-${uuidv7()}@example.com`,
      "923009998877",
    );
    await db.insert(accounts).values({
      id: uuidv7(),
      userId: id,
      type: "oauth",
      provider: "instagram",
      providerAccountId: `ig-${id}`,
    });
    await saveCustomerAddress(id, {
      recipientName: "Amina Khan",
      phone: "03001112233",
      addressLine1: "4 Street",
      city: "Karachi",
      province: "SINDH",
    });
    expect(await eraseCustomerById(id, "self")).toBe("erased");
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);
    expect(row?.name).toBeNull();
    expect(row?.phone).toBeNull();
    expect(row?.status).toBe("DISABLED");
    expect(row?.email.endsWith("@customers.aks.local")).toBe(true);
    expect(await loadAccountSnapshot(id)).toBeNull();
    const linked = await db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, id));
    expect(linked).toHaveLength(0);

    const staff = uuidv7();
    created.push(staff);
    await db.insert(users).values({
      id: staff,
      email: `staff-${staff}@example.com`,
      role: "STAFF",
      status: "ACTIVE",
    });
    expect(await eraseCustomerById(staff, "self")).toBe("kept");
  });
});
