/** Order / CRM first-contact channel labels (admin chrome). */

export const CRM_SOURCES = [
  "WEB",
  "WHATSAPP",
  "INSTAGRAM",
  "PHONE",
  "WALK_IN",
] as const;

export type CrmSource = (typeof CRM_SOURCES)[number];

export type CrmSourceFilter = "ALL" | CrmSource | "DUPLICATES";

export const CRM_SOURCE_LABEL: Record<CrmSource, string> = {
  WEB: "Web",
  WHATSAPP: "WhatsApp",
  INSTAGRAM: "Instagram",
  PHONE: "Phone",
  WALK_IN: "Walk-in",
};

export function parseCrmSource(raw: string | null | undefined): CrmSource | null {
  if (!raw) return null;
  const upper = raw.trim().toUpperCase();
  if ((CRM_SOURCES as readonly string[]).includes(upper)) {
    return upper as CrmSource;
  }
  return null;
}

export function crmSourceLabel(raw: string | null | undefined): string {
  const parsed = parseCrmSource(raw);
  return parsed ? CRM_SOURCE_LABEL[parsed] : raw?.trim() || "—";
}
