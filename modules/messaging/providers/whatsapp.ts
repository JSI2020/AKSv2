/**
 * WhatsApp Cloud API (Meta) provider. Mirrors the Resend email provider:
 * env-gated, with the handler falling back to log-only when unconfigured.
 *
 * Required env to actually send:
 *   WHATSAPP_ACCESS_TOKEN      — permanent/system-user token from Meta
 *   WHATSAPP_PHONE_NUMBER_ID   — the Cloud API phone number id
 *   WHATSAPP_API_VERSION       — optional, defaults to v21.0
 *
 * Note: free-form text only delivers inside the 24-hour customer-service
 * window. Business-initiated sends outside it require a pre-approved message
 * template registered in Meta Business Manager.
 */

type WhatsappGraphBody = {
  messages?: Array<{ id: string }>;
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

/** Server log line for a Cloud API failure. Never includes the access token. */
export function whatsappGraphError(status: number, body: WhatsappGraphBody): string {
  const error = body.error;
  const message =
    error?.message?.trim() || `WhatsApp send failed (HTTP ${status})`;
  const parts = [message];
  if (typeof error?.code === "number") parts.push(`code ${error.code}`);
  if (typeof error?.error_subcode === "number") {
    parts.push(`subcode ${error.error_subcode}`);
  }
  if (error?.type?.trim()) parts.push(error.type.trim());
  if (error?.fbtrace_id && /^[A-Za-z0-9_-]{6,80}$/.test(error.fbtrace_id)) {
    parts.push(`fbtrace ${error.fbtrace_id}`);
  }
  return parts
    .join(" ")
    .replace(/[A-Za-z0-9_\-~.]{80,}/g, "[redacted]")
    .slice(0, 300);
}

export async function sendWhatsappText(input: {
  to: string;
  body: string;
}): Promise<{ id: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp is not configured");
  }

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "text",
        text: { preview_url: true, body: input.body },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as WhatsappGraphBody;

  if (!res.ok) {
    throw new Error(whatsappGraphError(res.status, json));
  }

  return { id: json.messages?.[0]?.id ?? "sent" };
}

export function isWhatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
}

/** Send a pre-approved Meta template (business-initiated, outside 24h window). */
export async function sendWhatsappTemplate(input: {
  to: string;
  templateName: string;
  languageCode?: string;
  /** Body {{1}}, {{2}}… parameter values in order. */
  bodyParameters: string[];
  /**
   * Auth copy-code templates need the OTP on the button as well as the body.
   * When set, adds a `button` / `url` component at index 0 with this value.
   */
  buttonParameter?: string;
}): Promise<{ id: string }> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const version = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  if (!token || !phoneNumberId) {
    throw new Error("WhatsApp is not configured");
  }

  const components: Array<Record<string, unknown>> = [];
  if (input.bodyParameters.length > 0) {
    components.push({
      type: "body",
      parameters: input.bodyParameters.map((text) => ({
        type: "text",
        text,
      })),
    });
  }
  if (input.buttonParameter) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.buttonParameter }],
    });
  }

  const res = await fetch(
    `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: input.to,
        type: "template",
        template: {
          name: input.templateName,
          language: { code: input.languageCode ?? "en" },
          ...(components.length > 0 ? { components } : {}),
        },
      }),
    },
  );

  const json = (await res.json().catch(() => ({}))) as WhatsappGraphBody;

  if (!res.ok) {
    throw new Error(whatsappGraphError(res.status, json));
  }

  return { id: json.messages?.[0]?.id ?? "sent" };
}

/**
 * Cold sign-in OTP via an approved WhatsApp authentication (copy-code) template.
 * Env: WHATSAPP_TEMPLATE_AUTH (name) + optional WHATSAPP_TEMPLATE_AUTH_LANG (default en_US).
 */
export async function sendWhatsappAuthOtp(input: {
  to: string;
  code: string;
}): Promise<{ id: string }> {
  const templateName = process.env.WHATSAPP_TEMPLATE_AUTH?.trim();
  if (!templateName) {
    throw new Error("WHATSAPP_TEMPLATE_AUTH is not configured");
  }
  const languageCode =
    process.env.WHATSAPP_TEMPLATE_AUTH_LANG?.trim() || "en_US";

  return sendWhatsappTemplate({
    to: input.to,
    templateName,
    languageCode,
    bodyParameters: [input.code],
    buttonParameter: input.code,
  });
}
