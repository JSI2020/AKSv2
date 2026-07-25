import { Resend } from "resend";

import type { OutboxHandler } from "@/modules/platform";

export type EmailSendPayload = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

function isEmailSendPayload(
  payload: Record<string, unknown>,
): payload is EmailSendPayload {
  return (
    typeof payload.to === "string" &&
    typeof payload.subject === "string" &&
    (payload.html === undefined || typeof payload.html === "string") &&
    (payload.text === undefined || typeof payload.text === "string")
  );
}

/**
 * Outbox handler for `email.send`.
 * Uses Resend when RESEND_API_KEY is set; otherwise logs in development and still succeeds (SENT).
 */
export const handleEmailSend: OutboxHandler = async (payload) => {
  if (!isEmailSendPayload(payload)) {
    throw new Error("Invalid email.send payload");
  }

  const from =
    process.env.RESEND_FROM_EMAIL?.trim() || "AKS <onboarding@resend.dev>";
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    console.log(
      `[email.send] RESEND_API_KEY unset — logging only\n  to: ${payload.to}\n  subject: ${payload.subject}\n  text: ${payload.text ?? "(html only)"}`,
    );
    return;
  }

  const resend = new Resend(apiKey);
  const { error } = await resend.emails.send({
    from,
    to: payload.to,
    subject: payload.subject,
    html: payload.html ?? `<pre>${payload.text ?? ""}</pre>`,
    text: payload.text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
};
