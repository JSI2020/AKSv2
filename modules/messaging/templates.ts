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
    subject: "We have your order {{orderNumber}}",
    body: `Thank you, {{customerName}}. We have your order {{orderNumber}}.

If you chose cash on delivery, pay when it arrives. If you paid by transfer or online, you're all set — we'll prepare your pieces next.

You can follow every step here: {{trackUrl}}`,
  },
  {
    key: "order.confirmed",
    locale: "en",
    subject: "Order confirmed — {{orderNumber}}",
    body: `Good news, {{customerName}} — order {{orderNumber}} is confirmed and being prepared.

We'll message you with the courier and tracking number the moment it ships.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.measurements_verified",
    locale: "en",
    subject: "Order confirmed — {{orderNumber}}",
    body: `Order {{orderNumber}} is confirmed and being prepared.

We'll keep you posted at every step.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.cutting",
    locale: "en",
    subject: "Being prepared — {{orderNumber}}",
    body: `Your order {{orderNumber}} is being prepared for dispatch.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.stitching",
    locale: "en",
    subject: "Being finished — {{orderNumber}}",
    body: `Order {{orderNumber}} is being checked and finished by hand before it ships.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.embroidery",
    locale: "en",
    subject: "In the atelier — {{orderNumber}}",
    body: `Order {{orderNumber}} is with our team, getting the finishing detail it deserves.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.finishing",
    locale: "en",
    subject: "Finishing — {{orderNumber}}",
    body: `Order {{orderNumber}} is in finishing — a steam, a press, and the last quiet details.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.quality_check",
    locale: "en",
    subject: "Final check — {{orderNumber}}",
    body: `We're giving order {{orderNumber}} a final check before it leaves us.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.packed",
    locale: "en",
    subject: "Packed and ready — {{orderNumber}}",
    body: `Order {{orderNumber}} is packed and ready to travel. It ships next.

Follow your order here: {{trackUrl}}`,
  },
  {
    key: "order.dispatched",
    locale: "en",
    subject: "On its way — {{orderNumber}}",
    body: `Your order {{orderNumber}} is on its way, {{customerName}}.

Courier: {{courierName}}
Tracking / AWB: {{trackingNumber}}

Follow the parcel with the courier, or track your order here: {{trackUrl}}`,
  },
  {
    key: "order.delivered",
    locale: "en",
    subject: "Delivered — {{orderNumber}}",
    body: `Your order {{orderNumber}} has been delivered. We hope you love it, {{customerName}}.

If anything isn't right, just reply on WhatsApp — we're here to help.`,
  },
  {
    key: "order.completed",
    locale: "en",
    subject: "Thank you — {{orderNumber}}",
    body: `Order {{orderNumber}} is complete. Thank you for choosing AKS-Atelier, {{customerName}}.

We'd love to see how you style it — tag us when you wear it.`,
  },
  {
    key: "order.cancelled",
    locale: "en",
    subject: "Order cancelled — {{orderNumber}}",
    body: `Your order {{orderNumber}} has been cancelled.

If this wasn't expected, reply on WhatsApp and we'll look into it right away.`,
  },
  {
    key: "order.refund_pending",
    locale: "en",
    subject: "Refund in progress — {{orderNumber}}",
    body: `We're processing your refund for order {{orderNumber}}.

You'll get a confirmation the moment it's complete.`,
  },
  {
    key: "order.refunded",
    locale: "en",
    subject: "Refund complete — {{orderNumber}}",
    body: `Your refund for order {{orderNumber}} is complete.

Depending on your bank, it can take a few business days to appear.`,
  },
  {
    key: "order.delivery_refused",
    locale: "en",
    subject: "Delivery update — {{orderNumber}}",
    body: `We couldn't complete the delivery of order {{orderNumber}}.

Reply on WhatsApp and we'll arrange redelivery at a time that suits you.

Track your order here: {{trackUrl}}`,
  },
  {
    key: "track.otp",
    locale: "en",
    subject: "Your AKS-Atelier tracking code",
    body: `Your tracking code for order {{orderNumber}} is {{code}}.

It expires in 10 minutes.`,
  },
];

export function appendCustomerRemark(body: string, remark: string | null): string {
  const trimmed = remark?.trim();
  if (!trimmed) return body;
  return `${body}\n\nNote from us: ${trimmed}`;
}
