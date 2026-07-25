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

export const DESIGN_STATUSES = [
  "DRAFT",
  "BRIEF_COMPLETE",
  "INPUTS_UPLOADED",
  "HERO_GENERATING",
  "HERO_REVIEW",
  "HERO_LOCKED",
  "SIZING",
  "SIZING_LOCKED",
  "ANGLES_GENERATING",
  "ANGLES_REVIEW",
  "ANGLES_LOCKED",
  "COLOURWAYS_GENERATING",
  "COLOURWAYS_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type DesignStatus = (typeof DESIGN_STATUSES)[number];

/** Studio pipeline + catalog publish/archive transitions. */
export const DESIGN_STATUS_ALLOW: Record<DesignStatus, readonly DesignStatus[]> =
  {
    DRAFT: ["BRIEF_COMPLETE", "PUBLISHED", "ARCHIVED"],
    BRIEF_COMPLETE: ["INPUTS_UPLOADED", "DRAFT", "ARCHIVED"],
    INPUTS_UPLOADED: ["HERO_GENERATING", "BRIEF_COMPLETE", "ARCHIVED"],
    HERO_GENERATING: ["HERO_REVIEW", "ARCHIVED"],
    HERO_REVIEW: ["HERO_GENERATING", "HERO_LOCKED", "ARCHIVED"],
    HERO_LOCKED: ["SIZING", "HERO_REVIEW", "ARCHIVED"],
    SIZING: ["SIZING_LOCKED", "HERO_LOCKED", "ARCHIVED"],
    SIZING_LOCKED: ["ANGLES_GENERATING", "SIZING", "ARCHIVED"],
    ANGLES_GENERATING: ["ANGLES_REVIEW", "ARCHIVED"],
    ANGLES_REVIEW: ["ANGLES_GENERATING", "ANGLES_LOCKED", "ARCHIVED"],
    ANGLES_LOCKED: [
      "COLOURWAYS_GENERATING",
      "READY_TO_PUBLISH",
      "ANGLES_REVIEW",
      "ARCHIVED",
    ],
    COLOURWAYS_GENERATING: ["COLOURWAYS_REVIEW", "ARCHIVED"],
    COLOURWAYS_REVIEW: ["COLOURWAYS_GENERATING", "READY_TO_PUBLISH", "ARCHIVED"],
    READY_TO_PUBLISH: ["PUBLISHED", "COLOURWAYS_REVIEW", "ARCHIVED"],
    PUBLISHED: ["ARCHIVED", "DRAFT"],
    ARCHIVED: ["DRAFT"],
  };

/** Statuses at or past hero lock — downstream generation requires one of these. */
export const POST_HERO_LOCKED_STATUSES = [
  "HERO_LOCKED",
  "SIZING",
  "SIZING_LOCKED",
  "ANGLES_GENERATING",
  "ANGLES_REVIEW",
  "ANGLES_LOCKED",
  "COLOURWAYS_GENERATING",
  "COLOURWAYS_REVIEW",
  "READY_TO_PUBLISH",
  "PUBLISHED",
] as const satisfies readonly DesignStatus[];

export const RENDER_ANGLES = [
  "FRONT",
  "THREE_QUARTER",
  "BACK",
  "DETAIL",
] as const;
export type RenderAngle = (typeof RENDER_ANGLES)[number];
