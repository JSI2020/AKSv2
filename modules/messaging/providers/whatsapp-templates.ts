/**
 * Meta Business Manager template names for business-initiated WhatsApp sends.
 * Register each template in Meta, then set the env var to the approved name.
 * When unset, the handler falls back to free-form text (24h customer window only).
 */
export const WHATSAPP_META_TEMPLATE_ENV: Record<string, string> = {
  "order.received": "WHATSAPP_TEMPLATE_ORDER_RECEIVED",
  "order.confirmed": "WHATSAPP_TEMPLATE_ORDER_CONFIRMED",
  "order.measurements_verified": "WHATSAPP_TEMPLATE_ORDER_MEASUREMENTS",
  "order.cutting": "WHATSAPP_TEMPLATE_ORDER_CUTTING",
  "order.stitching": "WHATSAPP_TEMPLATE_ORDER_STITCHING",
  "order.embroidery": "WHATSAPP_TEMPLATE_ORDER_EMBROIDERY",
  "order.finishing": "WHATSAPP_TEMPLATE_ORDER_FINISHING",
  "order.quality_check": "WHATSAPP_TEMPLATE_ORDER_QC",
  "order.packed": "WHATSAPP_TEMPLATE_ORDER_PACKED",
  "order.dispatched": "WHATSAPP_TEMPLATE_ORDER_DISPATCHED",
  "order.delivered": "WHATSAPP_TEMPLATE_ORDER_DELIVERED",
  "order.completed": "WHATSAPP_TEMPLATE_ORDER_COMPLETED",
  "order.cancelled": "WHATSAPP_TEMPLATE_ORDER_CANCELLED",
  "order.refund_pending": "WHATSAPP_TEMPLATE_ORDER_REFUND_PENDING",
  "order.refunded": "WHATSAPP_TEMPLATE_ORDER_REFUNDED",
  "order.delivery_refused": "WHATSAPP_TEMPLATE_ORDER_REFUSED",
};

export function resolveWhatsappMetaTemplateName(
  templateKey: string,
): string | null {
  const envKey = WHATSAPP_META_TEMPLATE_ENV[templateKey];
  if (!envKey) return null;
  const name = process.env[envKey]?.trim();
  return name || null;
}

/** True when WHATSAPP_USE_TEMPLATES=1 and at least one template name is configured. */
export function whatsappTemplatesEnabled(): boolean {
  if (process.env.WHATSAPP_USE_TEMPLATES !== "1") return false;
  return Object.keys(WHATSAPP_META_TEMPLATE_ENV).some((key) =>
    Boolean(resolveWhatsappMetaTemplateName(key)),
  );
}
