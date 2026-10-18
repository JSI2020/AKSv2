import { NextResponse } from "next/server";

import { ingestWhatsappCoexistenceWebhook } from "@/modules/messaging/whatsapp-coexistence";
import {
  verifyWhatsappWebhookSignature,
  verifyWhatsappWebhookSubscription,
} from "@/modules/messaging/whatsapp-webhook";

export const runtime = "nodejs";

/**
 * Meta WhatsApp Cloud API webhook.
 * GET  — subscription verification (hub.challenge)
 * POST — inbound messages / status (acked; full inbox wiring later)
 *
 * Meta Callback URL: https://<public-host>/api/webhooks/whatsapp
 * Verify token:     WHATSAPP_WEBHOOK_VERIFY_TOKEN from .env
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const result = verifyWhatsappWebhookSubscription({
    mode: url.searchParams.get("hub.mode"),
    token: url.searchParams.get("hub.verify_token"),
    challenge: url.searchParams.get("hub.challenge"),
  });

  if (!result.ok) {
    return new NextResponse(null, { status: result.status });
  }

  return new NextResponse(result.challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-Hub-Signature-256");

  if (!verifyWhatsappWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let json: unknown = null;
  try {
    json = JSON.parse(rawBody) as unknown;
  } catch {
    return NextResponse.json({ received: true });
  }

  try {
    await ingestWhatsappCoexistenceWebhook(json);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "webhook failed";
    console.error(
      "[whatsapp.webhook]",
      detail.replace(/[A-Za-z0-9_\-~.]{24,}/g, "[redacted]").slice(0, 180),
    );
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
