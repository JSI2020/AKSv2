import { and, eq } from "drizzle-orm";

import { cartLines, carts, db } from "@aks/db";
import { uuidv7 } from "@aks/shared";

import type { CartCustomizationSelections } from "./types";
import { cartLineFingerprint } from "./types";

type LineIdentity = {
  designId: string;
  colourwayId: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurementProfileId: string | null;
  customizationSelections: CartCustomizationSelections;
};

function fingerprintFromLine(line: LineIdentity): string {
  return cartLineFingerprint({
    designId: line.designId,
    colourwayId: line.colourwayId,
    sizeMode: line.sizeMode,
    sizeLabel: line.sizeLabel,
    measurementProfileId: line.measurementProfileId,
    customizationSelections: line.customizationSelections ?? {},
  });
}

/**
 * Merge guest cart lines into the user cart without duplicating matching lines.
 */
export async function mergeGuestCartIntoUser(input: {
  userId: string;
  anonId: string;
}): Promise<void> {
  const [guestCart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.anonId, input.anonId), eq(carts.status, "ACTIVE")))
    .limit(1);

  if (!guestCart || guestCart.userId === input.userId) return;

  let [userCart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.userId, input.userId), eq(carts.status, "ACTIVE")))
    .limit(1);

  const now = new Date();

  if (!userCart) {
    await db
      .update(carts)
      .set({ userId: input.userId, updatedAt: now })
      .where(eq(carts.id, guestCart.id));
    return;
  }

  if (userCart.id === guestCart.id) return;

  const [guestLines, userLines] = await Promise.all([
    db.select().from(cartLines).where(eq(cartLines.cartId, guestCart.id)),
    db.select().from(cartLines).where(eq(cartLines.cartId, userCart.id)),
  ]);

  const userFingerprints = new Map(
    userLines.map((line) => [
      fingerprintFromLine({
        designId: line.designId,
        colourwayId: line.colourwayId,
        sizeMode: line.sizeMode,
        sizeLabel: line.sizeLabel,
        measurementProfileId: line.measurementProfileId,
        customizationSelections: line.customizationSelections ?? {},
      }),
      line,
    ]),
  );

  for (const guestLine of guestLines) {
    const fp = fingerprintFromLine({
      designId: guestLine.designId,
      colourwayId: guestLine.colourwayId,
      sizeMode: guestLine.sizeMode,
      sizeLabel: guestLine.sizeLabel,
      measurementProfileId: guestLine.measurementProfileId,
      customizationSelections: guestLine.customizationSelections ?? {},
    });

    const existing = userFingerprints.get(fp);
    if (existing) {
      await db
        .update(cartLines)
        .set({
          quantity: existing.quantity + guestLine.quantity,
          updatedAt: now,
        })
        .where(eq(cartLines.id, existing.id));
      await db.delete(cartLines).where(eq(cartLines.id, guestLine.id));
      userFingerprints.set(fp, {
        ...existing,
        quantity: existing.quantity + guestLine.quantity,
      });
      continue;
    }

    await db
      .update(cartLines)
      .set({ cartId: userCart.id, updatedAt: now })
      .where(eq(cartLines.id, guestLine.id));
  }

  await db
    .update(carts)
    .set({ status: "ABANDONED", updatedAt: now })
    .where(eq(carts.id, guestCart.id));

  await db
    .update(carts)
    .set({ expiresAt: guestCart.expiresAt, updatedAt: now })
    .where(eq(carts.id, userCart.id));
}

export async function upsertCartLine(input: {
  cartId: string;
  designId: string;
  colourwayId: string;
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
  measurementProfileId: string | null;
  customizationSelections: CartCustomizationSelections;
  unitPriceMinor: number;
  quantity: number;
}): Promise<string> {
  const existingLines = await db
    .select()
    .from(cartLines)
    .where(eq(cartLines.cartId, input.cartId));

  const fp = cartLineFingerprint({
    designId: input.designId,
    colourwayId: input.colourwayId,
    sizeMode: input.sizeMode,
    sizeLabel: input.sizeLabel,
    measurementProfileId: input.measurementProfileId,
    customizationSelections: input.customizationSelections,
  });

  const match = existingLines.find(
    (line) =>
      cartLineFingerprint({
        designId: line.designId,
        colourwayId: line.colourwayId,
        sizeMode: line.sizeMode,
        sizeLabel: line.sizeLabel,
        measurementProfileId: line.measurementProfileId,
        customizationSelections: line.customizationSelections ?? {},
      }) === fp,
  );

  const now = new Date();

  if (match) {
    await db
      .update(cartLines)
      .set({
        quantity: match.quantity + input.quantity,
        unitPriceMinor: input.unitPriceMinor,
        updatedAt: now,
      })
      .where(eq(cartLines.id, match.id));
    return match.id;
  }

  const id = uuidv7();
  await db.insert(cartLines).values({
    id,
    cartId: input.cartId,
    designId: input.designId,
    colourwayId: input.colourwayId,
    sizeMode: input.sizeMode,
    sizeLabel: input.sizeLabel,
    measurementProfileId: input.measurementProfileId,
    customizationSelections: input.customizationSelections,
    unitPriceMinor: input.unitPriceMinor,
    quantity: input.quantity,
    createdAt: now,
    updatedAt: now,
  });

  return id;
}
