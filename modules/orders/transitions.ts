import { and, eq } from "drizzle-orm";

import { orderEvents, orders } from "@aks/db";
import {
  registerEntityTransitions,
  type TransitionAllowList,
} from "@/modules/platform/transition";

import { ORDER_STATUS_ALLOW, type OrderStatus } from "./constants";

export const ORDER_TRANSITION_ALLOW: TransitionAllowList =
  ORDER_STATUS_ALLOW as TransitionAllowList;

let registered = false;

export function registerOrderTransitions(): void {
  if (registered) return;
  registered = true;

  registerEntityTransitions("order", {
    applyStatusChange: async (tx, id, from, to) => {
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
      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(orderEvents).values(row);
    },
  });
}

registerOrderTransitions();
