import { eq } from "drizzle-orm";

import { db, messageLog } from "@aks/db";

import type { OutboxHandler } from "@/modules/platform/outbox";

import {
  appendCustomerRemark,
  loadMessageTemplate,
  renderTemplate,
} from "./templates";
import { isWhatsappConfigured, sendWhatsappTemplate, sendWhatsappText } from "./providers/whatsapp";
import { resolveWhatsappMetaTemplateName, whatsappTemplatesEnabled } from "./providers/whatsapp-templates";

/**
 * WhatsApp delivery for order-status notifications. Renders the same English
 * template the email uses, then sends via the Meta Cloud API. When WhatsApp
 * env is unset it logs and marks the message sent (dev fallback), so the queue
 * behaves identically with or without credentials.
 */
export const handleWhatsappNotify: OutboxHandler = async (payload) => {
  const messageLogId =
    typeof payload.messageLogId === "string" ? payload.messageLogId : null;
  const to = typeof payload.to === "string" ? payload.to : null;
  const templateKey =
    typeof payload.templateKey === "string" ? payload.templateKey : null;
  if (!messageLogId || !to || !templateKey) return;

  const vars: Record<string, string> = {
    orderNumber: String(payload.orderNumber ?? ""),
    customerName: String(payload.customerName ?? "there"),
    trackUrl: String(payload.trackUrl ?? ""),
  };

  const template = await loadMessageTemplate({ key: templateKey, locale: "en" });
  let body = template
    ? renderTemplate(template.body, vars)
    : `Update on your order ${vars.orderNumber}.`;
  body = appendCustomerRemark(
    body,
    typeof payload.note === "string" ? payload.note : null,
  );

  if (!isWhatsappConfigured()) {
    console.log(
      `[whatsapp.notify] WHATSAPP env unset — logging only · to=${to} · template=${templateKey}\n${body}`,
    );
    await db
      .update(messageLog)
      .set({
        status: "SENT",
        sentAt: new Date(),
        providerRef: "dev-log-only",
        error: null,
      })
      .where(eq(messageLog.id, messageLogId));
    return;
  }

  try {
    const metaTemplate = whatsappTemplatesEnabled()
      ? resolveWhatsappMetaTemplateName(templateKey)
      : null;

    const result = metaTemplate
      ? await sendWhatsappTemplate({
          to,
          templateName: metaTemplate,
          bodyParameters: [
            vars.customerName ?? "there",
            vars.orderNumber ?? "",
            vars.trackUrl ?? "",
          ],
        })
      : await sendWhatsappText({ to, body });
    await db
      .update(messageLog)
      .set({
        status: "SENT",
        sentAt: new Date(),
        providerRef: result.id,
        error: null,
      })
      .where(eq(messageLog.id, messageLogId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "WhatsApp send failed";
    await db
      .update(messageLog)
      .set({ status: "FAILED", error: message })
      .where(eq(messageLog.id, messageLogId));
    throw error;
  }
};
