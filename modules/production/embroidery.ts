import { and, eq, inArray } from "drizzle-orm";

import { designTags, orderItems } from "@aks/db";
import type { DbTx } from "@/modules/platform/types";

import { EMBROIDERY_WORK_TAGS } from "@/modules/orders/embroidery";

export async function orderItemRequiresEmbroidery(
  orderItemId: string,
  tx: DbTx,
): Promise<boolean> {
  const [item] = await tx
    .select({ designId: orderItems.designId })
    .from(orderItems)
    .where(eq(orderItems.id, orderItemId))
    .limit(1);

  if (!item) return false;

  const tags = await tx
    .select({ value: designTags.value })
    .from(designTags)
    .where(
      and(
        eq(designTags.designId, item.designId),
        eq(designTags.kind, "WORK"),
        inArray(designTags.value, [...EMBROIDERY_WORK_TAGS]),
      ),
    )
    .limit(1);

  return tags.length > 0;
}
