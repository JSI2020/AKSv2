import { eq } from "drizzle-orm";
import { Resend } from "resend";

import { db, messageLog } from "@aks/db";

import type { OutboxHandler } from "@/modules/platform/outbox";

import {
  appendCustomerRemark,
  loadMessageTemplate,
  renderTemplate,
} from "./templates";

export type MessageSendPayload = {
  messageLogId: string;
  recipient: string;
  templateKey: string;
  locale: string;
  vars: Record<string, string>;
  customerRemark?: string | null;
};

function isMessageSendPayload(
  payload: Record<string, unknown>,
): payload is MessageSendPayload {
  return (
    typeof payload.messageLogId === "string" &&
    typeof payload.recipient === "string" &&
    typeof payload.templateKey === "string" &&
    typeof payload.locale === "string" &&
    typeof payload.vars === "object" &&
    payload.vars !== null
  );
}

/**
 * Outbox handler for `message.send` — renders a template and delivers via Resend.
 */
export const handleMessageSend: OutboxHandler = async (payload) => {
  if (!isMessageSendPayload(payload)) {
    throw new Error("Invalid message.send payload");
  }

  const template = await loadMessageTemplate({
    key: payload.templateKey,
    locale: payload.locale,
  });

  if (!template) {
    throw new Error(`No template found for ${payload.templateKey}`);
  }

  const subject = renderTemplate(template.subject, payload.vars);
  let body = renderTemplate(template.body, payload.vars);
  body = appendCustomerRemark(body, payload.customerRemark ?? null);

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "AKS <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.log(
      `[message.send] RESEND_API_KEY unset — logging only\n  to: ${payload.recipient}\n  subject: ${subject}\n  text: ${body}`,
    );
    await db
      .update(messageLog)
      .set({
        status: "SENT",
        sentAt: new Date(),
        providerRef: "dev-log-only",
        error: null,
      })
      .where(eq(messageLog.id, payload.messageLogId));
    return;
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: payload.recipient,
    subject,
    html: `<pre style="font-family: sans-serif; white-space: pre-wrap;">${body.replace(/</g, "&lt;")}</pre>`,
    text: body,
  });

  if (error) {
    await db
      .update(messageLog)
      .set({
        status: "FAILED",
        error: error.message,
      })
      .where(eq(messageLog.id, payload.messageLogId));
    throw new Error(`Resend error: ${error.message}`);
  }

  await db
    .update(messageLog)
    .set({
      status: "SENT",
      sentAt: new Date(),
      providerRef: data?.id ?? null,
      error: null,
    })
    .where(eq(messageLog.id, payload.messageLogId));
};
