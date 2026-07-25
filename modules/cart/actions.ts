"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { cartLines, carts, db } from "@aks/db";

import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";

import { computeCartLineUnitPrice } from "./compute-unit-price";
import { upsertCartLine } from "./merge";
import {
  getOrCreateActiveCart,
  hydrateCart,
  loadActiveCart,
  resolveMeasurementProfileId,
  type CartContext,
} from "./queries";
import type {
  AddToCartInput,
  AddToCartResult,
  CartMutationResult,
} from "./types";

async function getCartContext(): Promise<CartContext> {
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getOrSetAnonToken();
  return { userId, anonId };
}

function revalidateShopCart() {
  revalidatePath("/", "layout");
}

export async function fetchCart(): Promise<
  import("./types").CartPublic
> {
  const ctx = await getCartContext();
  return loadActiveCart(ctx);
}

export async function addToCart(
  input: AddToCartInput,
): Promise<AddToCartResult> {
  const quantity = Math.max(1, Math.min(99, input.quantity));

  if (input.sizeMode === "STANDARD" && !input.sizeLabel) {
    return { ok: false, error: "Choose a size before adding to cart." };
  }

  const ctx = await getCartContext();

  let measurementProfileId = input.measurementProfileId;
  if (input.sizeMode === "MADE_TO_MEASURE") {
    measurementProfileId =
      measurementProfileId ??
      (await resolveMeasurementProfileId({
        designId: input.designId,
        userId: ctx.userId,
        anonId: ctx.anonId,
      }));

    if (!measurementProfileId) {
      return {
        ok: false,
        error: "Complete your measurements before adding this piece.",
      };
    }
  }

  const price = await computeCartLineUnitPrice({
    designId: input.designId,
    colourwayId: input.colourwayId,
    sizeMode: input.sizeMode,
    customizationSelections: input.customizationSelections,
  });

  if (!price) {
    return {
      ok: false,
      error: "This design is no longer available in that configuration.",
    };
  }

  const cartId = await getOrCreateActiveCart(ctx);
  const lineId = await upsertCartLine({
    cartId,
    designId: input.designId,
    colourwayId: input.colourwayId,
    sizeMode: input.sizeMode,
    sizeLabel: input.sizeMode === "STANDARD" ? input.sizeLabel : null,
    measurementProfileId:
      input.sizeMode === "MADE_TO_MEASURE" ? measurementProfileId : null,
    customizationSelections: input.customizationSelections,
    unitPriceMinor: price.unitPriceMinor,
    quantity,
  });

  const now = new Date();
  await db
    .update(carts)
    .set({ updatedAt: now, expiresAt: new Date(now.getTime() + 90 * 86400000) })
    .where(eq(carts.id, cartId));

  const cart = await hydrateCart(cartId);
  if (!cart) {
    return { ok: false, error: "Could not load cart." };
  }

  revalidateShopCart();
  return { ok: true, cart, lineId };
}

export async function updateCartLineQuantity(input: {
  lineId: string;
  quantity: number;
}): Promise<CartMutationResult> {
  const quantity = Math.max(1, Math.min(99, input.quantity));
  const ctx = await getCartContext();
  const cartId = await getOrCreateActiveCart(ctx);

  const [line] = await db
    .select()
    .from(cartLines)
    .where(and(eq(cartLines.id, input.lineId), eq(cartLines.cartId, cartId)))
    .limit(1);

  if (!line) {
    return { ok: false, error: "Line not found." };
  }

  await db
    .update(cartLines)
    .set({ quantity, updatedAt: new Date() })
    .where(eq(cartLines.id, input.lineId));

  const cart = await hydrateCart(cartId);
  if (!cart) return { ok: false, error: "Could not load cart." };

  revalidateShopCart();
  return { ok: true, cart };
}

export async function removeCartLine(input: {
  lineId: string;
}): Promise<CartMutationResult> {
  const ctx = await getCartContext();
  const cartId = await getOrCreateActiveCart(ctx);

  await db
    .delete(cartLines)
    .where(and(eq(cartLines.id, input.lineId), eq(cartLines.cartId, cartId)));

  const cart = await hydrateCart(cartId);
  if (!cart) return { ok: false, error: "Could not load cart." };

  revalidateShopCart();
  return { ok: true, cart };
}
