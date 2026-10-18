import { and, eq, isNull } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";

import { addresses, customerProfiles, db, users } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import { linkOrderCustomer } from "./link-order-customer";

const userId = uuidv7();
const email = `checkout-match-${userId}@example.com`;

describe("linkOrderCustomer email match", () => {
  afterAll(async () => {
    await db.delete(addresses).where(eq(addresses.userId, userId));
    await db.delete(customerProfiles).where(eq(customerProfiles.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  });

  it("keeps the saved phone and address and adds the checkout ones", async () => {
    await db.insert(users).values({
      id: userId,
      email,
      name: "Existing Customer",
      phone: "03001110001",
      role: "CUSTOMER",
      status: "ACTIVE",
    });
    await db.insert(customerProfiles).values({
      userId,
      whatsappNumber: "03001110001",
      source: "WEB",
    });
    await db.insert(addresses).values({
      id: uuidv7(),
      userId,
      label: "Shipping",
      recipientName: "Existing Customer",
      phone: "03001110001",
      addressLine1: "House 1",
      city: "Lahore",
      province: "PUNJAB",
      isDefaultShipping: true,
    });

    const checkout = {
      email,
      name: "Existing Customer",
      phone: "03002220002",
      whatsappNumber: "03002220002",
      source: "WEB",
      address: {
        recipientName: "Existing Customer",
        phone: "03002220002",
        whatsappNumber: "03002220002",
        addressLine1: "Lane 9",
        city: "Karachi",
        province: "SINDH" as const,
      },
    };

    const linked = await db.transaction((tx) => linkOrderCustomer(tx, checkout));
    expect(linked).toBe(userId);

    const again = await db.transaction((tx) => linkOrderCustomer(tx, checkout));
    expect(again).toBe(userId);

    const [user] = await db.select().from(users).where(eq(users.id, userId));
    expect(user?.phone).toBe("03001110001");
    expect(user?.name).toBe("Existing Customer");

    const [profile] = await db
      .select()
      .from(customerProfiles)
      .where(eq(customerProfiles.userId, userId));
    expect(profile?.whatsappNumber).toBe("03001110001");

    const rows = await db
      .select()
      .from(addresses)
      .where(and(eq(addresses.userId, userId), isNull(addresses.deletedAt)));
    expect(rows).toHaveLength(2);

    const original = rows.find((row) => row.city === "Lahore");
    const added = rows.find((row) => row.city === "Karachi");
    expect(original?.isDefaultShipping).toBe(true);
    expect(original?.phone).toBe("03001110001");
    expect(original?.addressLine1).toBe("House 1");
    expect(added?.isDefaultShipping).toBe(false);
    expect(added?.label).toBe("Checkout");
    expect(added?.phone).toBe("03002220002");
    expect(added?.addressLine1).toBe("Lane 9");
  });
});
