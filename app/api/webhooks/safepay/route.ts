import { NextResponse } from "next/server";

import {
  processSafepayWebhook,
  WebhookVerificationError,
} from "@/modules/payments";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("X-SFPY-SIGNATURE");
  const timestamp = request.headers.get("X-SFPY-TIMESTAMP");
  const eventId = request.headers.get("X-SFPY-EVENT-ID");
  const eventType = request.headers.get("X-SFPY-EVENT-TYPE") ?? undefined;

  if (!signature || !timestamp || !eventId) {
    return NextResponse.json(
      { error: "Missing Safepay webhook headers." },
      { status: 400 },
    );
  }

  try {
    await processSafepayWebhook({
      rawBody,
      signature,
      context: {
        timestamp,
        eventId,
        eventType,
      },
    });
    return NextResponse.json({ received: true });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("[safepay-webhook]", error);
    return NextResponse.json({ error: "Webhook processing failed." }, {
      status: 500,
    });
  }
}
