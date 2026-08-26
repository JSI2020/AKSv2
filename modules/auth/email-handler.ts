import type { OutboxHandler } from "@/modules/platform/outbox";
import {
  isResendConfigured,
  resolveFromEmail,
  sendResendEmail,
} from "@/modules/messaging/providers/resend";

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

  if (!isResendConfigured()) {
    console.log(
      `[email.send] RESEND_API_KEY unset — logging only\n  to: ${payload.to}\n  subject: ${payload.subject}\n  text: ${payload.text ?? "(html only)"}`,
    );
    return;
  }

  await sendResendEmail({
    from: resolveFromEmail(),
    to: payload.to,
    subject: payload.subject,
    html: payload.html,
    text: payload.text,
  });
};
