import { transition, type TransitionActor } from "@/modules/platform/transition";
import type { DbTx } from "@/modules/platform/types";

import { ORDER_STATUS_ALLOW, assertCuttingGate, type OrderStatus } from "./constants";

export async function transitionOrder(input: {
  orderId: string;
  from: OrderStatus;
  to: OrderStatus;
  actor: TransitionActor;
  note?: string;
  tx: DbTx;
}): Promise<void> {
  assertCuttingGate(input.from, input.to);

  await transition({
    entity: "order",
    id: input.orderId,
    from: input.from,
    to: input.to,
    actor: input.actor,
    note: input.note,
    allowList: ORDER_STATUS_ALLOW,
    tx: input.tx,
  });
}
