/** Design pipeline statuses that need a human review or publish action. */
export const DESIGN_AWAITING_REVIEW_STATUSES = [
  "HERO_REVIEW",
  "ANGLES_REVIEW",
  "COLOURWAYS_REVIEW",
  "READY_TO_PUBLISH",
] as const;
