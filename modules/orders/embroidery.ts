import { and, eq, inArray } from "drizzle-orm";

import { designTags, orderItems } from "@aks/db";
import type { DbTx } from "@/modules/platform/types";

/** WORK tags that require the embroidery production stage. */
export const EMBROIDERY_WORK_TAGS = [
  "EMBROIDERED",
  "HAND_EMBELLISHED",
  "ZARI",
  "ZARDOZI",
  "SEQUIN",
  "MIRROR_WORK",
] as const;

export async function orderRequiresEmbroidery(
  orderId: string,
  tx: DbTx,
): Promise<boolean> {
  const items = await tx
    .select({ designId: orderItems.designId })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) return false;

  const designIds = [...new Set(items.map((i) => i.designId))];
  const tags = await tx
    .select({ designId: designTags.designId, value: designTags.value })
    .from(designTags)
    .where(
      and(
        inArray(designTags.designId, designIds),
        eq(designTags.kind, "WORK"),
        inArray(designTags.value, [...EMBROIDERY_WORK_TAGS]),
      ),
    );

  return tags.length > 0;
}
