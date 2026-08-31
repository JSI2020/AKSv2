/** Storefront / manual studio scene presets — user can override with custom text. */
export const STUDIO_BACKGROUND_PRESETS = [
  {
    id: "courtyard",
    label: "Soft courtyard daylight",
    prompt:
      "Soft outdoor daylight courtyard with warm stone, gentle shadows, and natural depth — real location photography.",
  },
  {
    id: "marble-foyer",
    label: "Marble foyer",
    prompt:
      "Elegant marble foyer interior with diffused window light, subtle architectural depth, boutique campaign feel.",
  },
  {
    id: "garden",
    label: "Garden path",
    prompt:
      "Quiet garden path with greenery bokeh, soft morning light, and a dress-compatible natural backdrop.",
  },
  {
    id: "boutique",
    label: "Boutique interior",
    prompt:
      "Warm boutique interior with muted walls, soft directional light, and understated luxury — not a flat studio sweep.",
  },
  {
    id: "terrace",
    label: "Evening terrace",
    prompt:
      "Warm evening terrace with city-soft blur in the distance, golden-hour light, and real photographic depth.",
  },
] as const;

export type StudioBackgroundPresetId =
  (typeof STUDIO_BACKGROUND_PRESETS)[number]["id"];

export function resolveStudioBackgroundPrompt(input: {
  presetId?: string | null;
  custom?: string | null;
}): string {
  const custom = input.custom?.trim();
  if (custom) return custom;
  const preset = STUDIO_BACKGROUND_PRESETS.find((p) => p.id === input.presetId);
  return preset?.prompt ?? STUDIO_BACKGROUND_PRESETS[0]!.prompt;
}
