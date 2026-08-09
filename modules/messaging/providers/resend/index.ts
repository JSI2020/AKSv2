import { Resend } from "resend";

export type ResendEmailInput = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export type ResendSendResult = {
  id: string | null;
};

/**
 * Thin Resend adapter — only this module may import the `resend` SDK.
 */
export async function sendResendEmail(
  input: ResendEmailInput,
): Promise<ResendSendResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set.");
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: input.from,
    to: input.to,
    subject: input.subject,
    html: input.html ?? `<pre>${input.text ?? ""}</pre>`,
    text: input.text,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }

  return { id: data?.id ?? null };
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}
