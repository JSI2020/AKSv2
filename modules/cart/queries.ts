import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import {
  assets,
  cartLines,
  carts,
  colourways,
  db,
  designRenders,
  designs,
  measurementFlowSessions,
} from "@aks/db";

import { createPresignedReadUrl } from "@/modules/platform/assets/r2";
import { formatLeadTime } from "@/modules/catalog";

import type { CartPublic } from "./types";
import { formatCartLeadTime } from "./types";

const CART_TTL_DAYS = 90;

export function cartExpiresAt(from = new Date()): Date {
  const expires = new Date(from);
  expires.setDate(expires.getDate() + CART_TTL_DAYS);
  return expires;
}

export type CartContext = {
  userId: string | null;
  anonId: string;
};

export async function resolveMeasurementProfileId(input: {
  designId: string;
  userId: string | null;
  anonId: string | null;
}): Promise<string | null> {
  const rows = await db
    .select({ id: measurementFlowSessions.id })
    .from(measurementFlowSessions)
    .where(
      and(
        eq(measurementFlowSessions.designId, input.designId),
        isNotNull(measurementFlowSessions.completedAt),
        input.userId
          ? eq(measurementFlowSessions.userId, input.userId)
          : input.anonId
            ? eq(measurementFlowSessions.anonToken, input.anonId)
            : eq(measurementFlowSessions.id, "00000000-0000-0000-0000-000000000000"),
      ),
    )
    .orderBy(desc(measurementFlowSessions.updatedAt))
    .limit(1);

  return rows[0]?.id ?? null;
}

async function loadThumbnailUrl(
  designId: string,
  colourwayId: string,
): Promise<string | null> {
  const rows = await db
    .select({ r2Key: assets.r2Key })
    .from(designRenders)
    .innerJoin(assets, eq(designRenders.assetId, assets.id))
    .where(
      and(
        eq(designRenders.designId, designId),
        eq(designRenders.colourwayId, colourwayId),
        eq(designRenders.angle, "FRONT"),
      ),
    )
    .limit(1);

  const key = rows[0]?.r2Key;
  if (!key) return null;

  try {
    return await createPresignedReadUrl(key, 3600);
  } catch {
    return null;
  }
}

export async function hydrateCart(cartId: string): Promise<CartPublic | null> {
  const [cart] = await db
    .select()
    .from(carts)
    .where(and(eq(carts.id, cartId), eq(carts.status, "ACTIVE")))
    .limit(1);

  if (!cart) return null;

  const lines = await db
    .select()
    .from(cartLines)
    .where(eq(cartLines.cartId, cartId))
    .orderBy(cartLines.createdAt);

  if (lines.length === 0) {
    return {
      id: cart.id,
      lines: [],
      itemCount: 0,
      subtotalMinor: 0,
      leadTimeLabel: formatCartLeadTime(null),
    };
  }

  const designIds = [...new Set(lines.map((l) => l.designId))];
  const colourwayIds = [...new Set(lines.map((l) => l.colourwayId))];

  const [designRows, colourwayRows] = await Promise.all([
    db
      .select({
        id: designs.id,
        slug: designs.slug,
        name: designs.name,
        leadTimeDaysOverride: designs.leadTimeDaysOverride,
      })
      .from(designs)
      .where(inArray(designs.id, designIds)),
    db
      .select({
        id: colourways.id,
        name: colourways.name,
      })
      .from(colourways)
      .where(inArray(colourways.id, colourwayIds)),
  ]);

  const designById = new Map(designRows.map((d) => [d.id, d]));
  const colourwayById = new Map(colourwayRows.map((c) => [c.id, c]));

  const thumbnails = await Promise.all(
    lines.map((line) => loadThumbnailUrl(line.designId, line.colourwayId)),
  );

  let subtotalMinor = 0;
  let itemCount = 0;
  let maxLeadTimeDays: number | null = null;

  const publicLines = lines.map((line, index) => {
    const design = designById.get(line.designId);
    const colourway = colourwayById.get(line.colourwayId);
    const lineTotalMinor = line.unitPriceMinor * line.quantity;
    subtotalMinor += lineTotalMinor;
    itemCount += line.quantity;

    const leadDays = design?.leadTimeDaysOverride ?? null;
    if (leadDays != null) {
      maxLeadTimeDays =
        maxLeadTimeDays == null ? leadDays : Math.max(maxLeadTimeDays, leadDays);
    }

    return {
      id: line.id,
      designId: line.designId,
      designSlug: design?.slug ?? "",
      designName: design?.name ?? "",
      colourwayId: line.colourwayId,
      colourwayName: colourway?.name ?? "",
      sizeMode: line.sizeMode as "STANDARD" | "MADE_TO_MEASURE",
      sizeLabel: line.sizeLabel,
      quantity: line.quantity,
      unitPriceMinor: line.unitPriceMinor,
      lineTotalMinor,
      thumbnailUrl: thumbnails[index] ?? null,
      leadTimeDays: leadDays,
    };
  });

  return {
    id: cart.id,
    lines: publicLines,
    itemCount,
    subtotalMinor,
    leadTimeLabel:
      maxLeadTimeDays != null
        ? formatLeadTime(maxLeadTimeDays)
        : formatCartLeadTime(null),
  };
}

export async function getActiveCartId(ctx: CartContext): Promise<string | null> {
  if (ctx.userId) {
    const [userCart] = await db
      .select({ id: carts.id })
      .from(carts)
      .where(and(eq(carts.userId, ctx.userId), eq(carts.status, "ACTIVE")))
      .limit(1);
    if (userCart) return userCart.id;
  }

  const [anonCart] = await db
    .select({ id: carts.id })
    .from(carts)
    .where(and(eq(carts.anonId, ctx.anonId), eq(carts.status, "ACTIVE")))
    .limit(1);

  return anonCart?.id ?? null;
}

export async function getOrCreateActiveCart(ctx: CartContext): Promise<string> {
  const existingId = await getActiveCartId(ctx);
  if (existingId) {
    if (ctx.userId) {
      await db
        .update(carts)
        .set({ userId: ctx.userId, updatedAt: new Date() })
        .where(eq(carts.id, existingId));
    }
    return existingId;
  }

  const { uuidv7 } = await import("@aks/shared");
  const id = uuidv7();
  const now = new Date();

  await db.insert(carts).values({
    id,
    userId: ctx.userId,
    anonId: ctx.anonId,
    status: "ACTIVE",
    expiresAt: cartExpiresAt(now),
    createdAt: now,
    updatedAt: now,
  });

  return id;
}

export async function loadActiveCart(ctx: CartContext): Promise<CartPublic> {
  const cartId = await getActiveCartId(ctx);
  if (!cartId) {
    return {
      id: "",
      lines: [],
      itemCount: 0,
      subtotalMinor: 0,
      leadTimeLabel: formatCartLeadTime(null),
    };
  }

  const cart = await hydrateCart(cartId);
  return (
    cart ?? {
      id: "",
      lines: [],
      itemCount: 0,
      subtotalMinor: 0,
      leadTimeLabel: formatCartLeadTime(null),
    }
  );
}
