import { eq } from "drizzle-orm";

import { db, messageLog } from "@aks/db";

import type { OutboxHandler } from "@/modules/platform/outbox";

/**
 * Stub WhatsApp delivery — logs and marks the message as sent.
 * Wire a real provider later; queue payload shape stays stable.
 */
export const handleWhatsappNotify: OutboxHandler = async (payload) => {
  const messageLogId =
    typeof payload.messageLogId === "string" ? payload.messageLogId : null;
  const to = typeof payload.to === "string" ? payload.to : null;
  const templateKey =
    typeof payload.templateKey === "string" ? payload.templateKey : null;

  console.log(
    `[whatsapp.notify] stub · to=${to ?? "?"} · template=${templateKey ?? "?"} · order=${String(payload.orderNumber ?? "")}`,
  );

  if (messageLogId) {
    await db
      .update(messageLog)
      .set({
        status: "SENT",
        sentAt: new Date(),
        error: null,
      })
      .where(eq(messageLog.id, messageLogId));
  }
};
