import { and, eq } from "drizzle-orm";

import { orderEvents, orders } from "@aks/db";
import {
  IllegalTransitionError,
  registerEntityTransitions,
  type TransitionAllowList,
} from "@/modules/platform/transition";

import {
  assertCuttingGate,
  ORDER_STATUS_ALLOW,
  type OrderStatus,
} from "./constants";
import {
  reserveFabricForOrder,
  releaseFabricForOrder,
} from "@/modules/inventory";
import { createProductionJobsForOrder } from "@/modules/production/create-jobs";

export const ORDER_TRANSITION_ALLOW: TransitionAllowList =
  ORDER_STATUS_ALLOW as TransitionAllowList;

let registered = false;

export function registerOrderTransitions(): void {
  if (registered) return;
  registered = true;

  registerEntityTransitions("order", {
    applyStatusChange: async (tx, id, from, to) => {
      assertCuttingGate(from as OrderStatus, to as OrderStatus);

      if (to === "EMBROIDERY") {
        const [order] = await tx
          .select({ skipEmbroidery: orders.skipEmbroidery })
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (order?.skipEmbroidery) {
          throw new IllegalTransitionError("order", from, to);
        }
      }

      const patch: {
        status: OrderStatus;
        updatedAt: Date;
        placedAt?: Date;
        cancelledAt?: Date | null;
      } = {
        status: to as OrderStatus,
        updatedAt: new Date(),
      };

      if (to === "AWAITING_DEPOSIT" && from === "DRAFT") {
        patch.placedAt = new Date();
      }
      if (to === "CANCELLED" || to === "REFUND_PENDING") {
        patch.cancelledAt = new Date();
      }

      const rows = await tx
        .update(orders)
        .set(patch)
        .where(and(eq(orders.id, id), eq(orders.status, from as OrderStatus)))
        .returning({ id: orders.id });

      if (rows.length === 1) {
        if (to === "MEASUREMENTS_CONFIRMED") {
          await reserveFabricForOrder(id, tx);
          await createProductionJobsForOrder(
            id,
            { id: "00000000-0000-7000-8000-000000000002", role: "SYSTEM" },
            tx,
          );
        }
        if (
          (to === "CANCELLED" || to === "REFUND_PENDING") &&
          from === "MEASUREMENTS_CONFIRMED"
        ) {
          await releaseFabricForOrder(id, tx);
        }
      }

      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(orderEvents).values(row);
    },
  });
}

registerOrderTransitions();
