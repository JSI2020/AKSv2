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

export function isWhatsappConfigured(): boolean {
  return Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      process.env.WHATSAPP_PHONE_NUMBER_ID?.trim(),
  );
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

  const json = (await res.json().catch(() => ({}))) as {
    messages?: Array<{ id: string }>;
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(
      json.error?.message ?? `WhatsApp send failed (HTTP ${res.status})`,
    );
  }

  return { id: json.messages?.[0]?.id ?? "sent" };
}
