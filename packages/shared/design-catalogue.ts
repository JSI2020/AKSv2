/**
 * Allowed design_tags values (seed catalogue — not free text in admin).
 */
export const DESIGN_TAG_KINDS = ["OCCASION", "SEASON", "WORK", "FREE"] as const;
export type DesignTagKind = (typeof DESIGN_TAG_KINDS)[number];

export const DESIGN_TAG_VALUES: Record<
  Exclude<DesignTagKind, "FREE">,
  readonly string[]
> = {
  OCCASION: [
    "CASUAL",
    "EVERYDAY",
    "FORMAL",
    "SEMI_FORMAL",
    "FESTIVE",
    "PARTY",
    "EVENING",
    "EID",
    "WEDDING_GUEST",
    "MEHNDI",
    "BARAAT",
    "WALIMA",
    "NIKAH",
    "BRIDAL",
    "OFFICE",
  ],
  SEASON: [
    "SUMMER",
    "WINTER",
    "SPRING",
    "AUTUMN",
    "MID_SEASON",
    "FESTIVE",
    "WEDDING",
  ],
  WORK: [
    "EMBROIDERED",
    "PRINTED",
    "PLAIN",
    "HAND_EMBELLISHED",
    "ZARI",
    "ZARDOZI",
    "SEQUIN",
    "BLOCK_PRINT",
    "DIGITAL_PRINT",
    "MIRROR_WORK",
  ],
};

export function isValidDesignTag(kind: string, value: string): boolean {
  if (kind === "FREE") return value.trim().length > 0 && value.length <= 64;
  if (kind in DESIGN_TAG_VALUES) {
    return (
      DESIGN_TAG_VALUES[kind as Exclude<DesignTagKind, "FREE">] as readonly string[]
    ).includes(value);
  }
  return false;
}

export const DESIGN_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

export const DESIGN_STATUS_ALLOW: Record<DesignStatus, readonly DesignStatus[]> =
  {
    DRAFT: ["PUBLISHED", "ARCHIVED"],
    PUBLISHED: ["ARCHIVED", "DRAFT"],
    ARCHIVED: ["DRAFT"],
  };

export const RENDER_ANGLES = [
  "FRONT",
  "THREE_QUARTER",
  "BACK",
  "DETAIL",
] as const;
export type RenderAngle = (typeof RENDER_ANGLES)[number];
