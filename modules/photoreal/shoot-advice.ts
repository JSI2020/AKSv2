/**
 * House photography direction and the defaults used when the AI advisor is
 * unavailable. Shared by the advisor (server) and the shoot UI (client).
 */
export const BRAND_DIRECTION =
  "The house style is minimalist luxury: natural light, neutral backgrounds and calm architecture, refined understated styling, and close-ups that celebrate embroidery and craftsmanship. The garment always leads; settings never compete with it.";

/** Detail close-ups — every recommended set includes at least one. */
export const DETAIL_SHOT_IDS = [
  "detail-embroidery",
  "detail-neckline",
  "detail-sleeve",
  "detail-hem",
];

export const FALLBACK_ADVICE = {
  garment: "",
  occasion: "",
  locations: ["studio-window", "jaali-light", "studio"],
  shots: [
    "front-straight",
    "three-quarter-stand",
    "walk-toward",
    "portrait-half",
    "back-three-quarter",
    "detail-embroidery",
  ],
  reason:
    "Our house look: natural light and neutral settings that let the garment lead, with an embroidery close-up.",
  fromAi: false,
};
