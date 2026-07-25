import { eq } from "drizzle-orm";

import { fabricLots } from "@aks/db";

import type { DbTx } from "@/modules/platform/types";

export function lotAvailableMeters(lot: {
  metersOnHand: number;
  metersReserved: number;
}): number {
  return lot.metersOnHand - lot.metersReserved;
}

export async function refreshFabricLotStatus(
  tx: DbTx,
  lotId: string,
): Promise<void> {
  const [lot] = await tx
    .select({
      id: fabricLots.id,
      metersOnHand: fabricLots.metersOnHand,
      metersReserved: fabricLots.metersReserved,
      status: fabricLots.status,
    })
    .from(fabricLots)
    .where(eq(fabricLots.id, lotId))
    .limit(1);

  if (!lot || lot.status === "QUARANTINED") return;

  const available = lotAvailableMeters(lot);
  let nextStatus: "AVAILABLE" | "LOW" | "DEPLETED" = "AVAILABLE";

  if (available <= 0 && lot.metersOnHand <= 0) {
    nextStatus = "DEPLETED";
  } else if (available <= 0) {
    nextStatus = "LOW";
  }

  if (nextStatus !== lot.status) {
    await tx
      .update(fabricLots)
      .set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(fabricLots.id, lotId));
  }
}
