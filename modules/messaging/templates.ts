import { and, desc, eq } from "drizzle-orm";

import { db, messageTemplates } from "@aks/db";

export { ORDER_STATUS_TEMPLATE_KEYS } from "./template-keys";

export type TemplateVars = Record<string, string>;

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export async function loadMessageTemplate(input: {
  key: string;
  locale: string;
}): Promise<{ subject: string; body: string; version: number } | null> {
  const preferred = await db
    .select({
      subject: messageTemplates.subject,
      body: messageTemplates.body,
      version: messageTemplates.version,
    })
    .from(messageTemplates)
    .where(
      and(
        eq(messageTemplates.key, input.key),
        eq(messageTemplates.channel, "EMAIL"),
        eq(messageTemplates.locale, input.locale),
      ),
    )
    .orderBy(desc(messageTemplates.version))
    .limit(1);

  if (preferred[0]?.body.trim()) {
    return preferred[0];
  }

  if (input.locale !== "en") {
    const fallback = await db
      .select({
        subject: messageTemplates.subject,
        body: messageTemplates.body,
        version: messageTemplates.version,
      })
      .from(messageTemplates)
      .where(
        and(
          eq(messageTemplates.key, input.key),
          eq(messageTemplates.channel, "EMAIL"),
          eq(messageTemplates.locale, "en"),
        ),
      )
      .orderBy(desc(messageTemplates.version))
      .limit(1);

    if (fallback[0]) return fallback[0];
  }

  return preferred[0] ?? null;
}

export const MESSAGE_TEMPLATE_SEEDS: Array<{
  key: string;
  locale: string;
  subject: string;
  body: string;
}> = [
  {
    key: "order.received",
    locale: "en",
    subject: "We received your order {{orderNumber}}",
    body: `Your order {{orderNumber}} is in.

We received it — pay the deposit when you're ready and we'll begin. Nothing is cut until you do.

Track it anytime: {{trackUrl}}`,
  },
  {
    key: "order.confirmed",
    locale: "en",
    subject: "Deposit received — {{orderNumber}}",
    body: `Deposit received for order {{orderNumber}}.

We'll check your measurements next, then cut the fabric to yours — and only yours.`,
  },
  {
    key: "order.measurements_verified",
    locale: "en",
    subject: "Measurements checked — {{orderNumber}}",
    body: `Measurements checked for order {{orderNumber}}.

Your fabric will be cut to these numbers. Once that happens, this dress can't become anyone else's.`,
  },
  {
    key: "order.cutting",
    locale: "en",
    subject: "Being cut now — {{orderNumber}}",
    body: `Your karigar is cutting order {{orderNumber}} now — to your measurements, not a chart's.`,
  },
  {
    key: "order.stitching",
    locale: "en",
    subject: "With the karigar — {{orderNumber}}",
    body: `Order {{orderNumber}} is with the karigar now, being stitched by hand.`,
  },
  {
    key: "order.embroidery",
    locale: "en",
    subject: "Embroidery — {{orderNumber}}",
    body: `Embroidery has started on order {{orderNumber}}.`,
  },
  {
    key: "order.finishing",
    locale: "en",
    subject: "Finishing — {{orderNumber}}",
    body: `Order {{orderNumber}} is in finishing — buttons, hems, the last quiet details.`,
  },
  {
    key: "order.quality_check",
    locale: "en",
    subject: "Final check — {{orderNumber}}",
    body: `We're giving order {{orderNumber}} a final check before it leaves the workshop.`,
  },
  {
    key: "order.packed",
    locale: "en",
    subject: "Packed — {{orderNumber}}",
    body: `Order {{orderNumber}} is packed and ready to go.`,
  },
  {
    key: "order.dispatched",
    locale: "en",
    subject: "On its way — {{orderNumber}}",
    body: `Order {{orderNumber}} is on its way to you.`,
  },
  {
    key: "order.delivered",
    locale: "en",
    subject: "Delivered — {{orderNumber}}",
    body: `Order {{orderNumber}} was delivered. We hope it fits the way you wanted.`,
  },
  {
    key: "order.completed",
    locale: "en",
    subject: "Complete — {{orderNumber}}",
    body: `Order {{orderNumber}} is complete. Yours, and only yours.`,
  },
  {
    key: "order.cancelled",
    locale: "en",
    subject: "Order cancelled — {{orderNumber}}",
    body: `Order {{orderNumber}} has been cancelled.`,
  },
  {
    key: "order.refund_pending",
    locale: "en",
    subject: "Refund in progress — {{orderNumber}}",
    body: `We're processing a refund for order {{orderNumber}}.`,
  },
  {
    key: "order.refunded",
    locale: "en",
    subject: "Refund complete — {{orderNumber}}",
    body: `Refund for order {{orderNumber}} is complete.`,
  },
  {
    key: "order.delivery_refused",
    locale: "en",
    subject: "Delivery update — {{orderNumber}}",
    body: `Delivery for order {{orderNumber}} was refused. Message us on WhatsApp and we'll sort it.`,
  },
  {
    key: "order.received",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.confirmed",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.measurements_verified",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.cutting",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.stitching",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.embroidery",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.finishing",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.quality_check",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.packed",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.dispatched",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.delivered",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.completed",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.cancelled",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.refund_pending",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.refunded",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "order.delivery_refused",
    locale: "ur",
    subject: "",
    body: "",
  },
  {
    key: "track.otp",
    locale: "en",
    subject: "Your AKS order tracking code",
    body: `Your tracking code for order {{orderNumber}} is {{code}}. It expires in 10 minutes.`,
  },
];

export function appendCustomerRemark(body: string, remark: string | null): string {
  const trimmed = remark?.trim();
  if (!trimmed) return body;
  return `${body}\n\nNote from us: ${trimmed}`;
}
