import type { DbTx } from "../types";
import { outbox } from "@aks/db";
import { uuidv7 } from "@aks/shared";

export type OutboxPayload = Record<string, unknown>;

/**
 * Transactional outbox write. Must be called inside the caller's transaction.
 * Never send email/WhatsApp/AI inline — enqueue only.
 */
export async function enqueue(
  topic: string,
  payload: OutboxPayload,
  tx: DbTx,
): Promise<string> {
  const id = uuidv7();
  await tx.insert(outbox).values({
    id,
    topic,
    payload,
    status: "PENDING",
    attempts: 0,
    availableAt: new Date(),
  });
  return id;
}
