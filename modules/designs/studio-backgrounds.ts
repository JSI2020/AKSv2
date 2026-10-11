/**
 * Scene presets for AI Studio and the design studio — real campaign locations,
 * grouped like a shoot brief. The user can still override with custom text.
 * Ids are stable (saved drafts reference them); add new ones, don't rename.
 */
export const STUDIO_BACKGROUND_GROUPS = [
  "Studio",
  "Heritage",
  "Interiors",
  "Outdoors",
] as const;

export type StudioBackgroundGroup = (typeof STUDIO_BACKGROUND_GROUPS)[number];

export const STUDIO_BACKGROUND_PRESETS = [
  // Studio
  {
    id: "studio",
    tone: ["#ece7dd", "#d6cfc2"],
    group: "Studio",
    label: "Clean studio",
    prompt:
      "Clean professional catalogue photo studio: a seamless backdrop in a soft neutral tone (warm off-white or light greige) that complements the dress, soft even lighting, and a gentle natural shadow at the feet — uncluttered, no props, no patterned wall.",
  },
  {
    id: "studio-plaster",
    tone: ["#e3d3bc", "#b9a283"],
    group: "Studio",
    label: "Textured plaster wall",
    prompt:
      "Minimal luxury studio set: a hand-finished limewash plaster wall in warm sand or stone tone, polished concrete floor, one soft directional key light creating gentle shadow — high-end lookbook feel.",
  },
  {
    id: "studio-arch",
    tone: ["#f1ebe0", "#cbbfa9"],
    group: "Studio",
    label: "Studio arch set",
    prompt:
      "Elegant studio set with a single smooth plaster arch in soft ivory, warm neutral floor, soft window-like key light — refined, architectural, uncluttered campaign set.",
  },
  {
    id: "studio-drape",
    tone: ["#c9b6a0", "#8c7660"],
    group: "Studio",
    label: "Fabric drape backdrop",
    prompt:
      "Studio backdrop of softly draped heavy fabric in a tone that complements the dress, gentle folds catching soft light, warm editorial lighting — luxury couture shoot feel.",
  },

  // Heritage
  {
    id: "courtyard",
    tone: ["#e6cfa6", "#a88a5f"],
    group: "Heritage",
    label: "Soft courtyard daylight",
    prompt:
      "Soft outdoor daylight courtyard with warm stone, gentle shadows, and natural depth — real location photography.",
  },
  {
    id: "haveli-arches",
    tone: ["#d9b88c", "#8a6440"],
    group: "Heritage",
    label: "Haveli arches",
    prompt:
      "Historic Mughal-era haveli corridor with carved sandstone arches receding into soft depth, dappled daylight on warm stone floors — real heritage location photography.",
  },
  {
    id: "carved-door",
    tone: ["#a77a52", "#5b3d25"],
    group: "Heritage",
    label: "Carved wooden door",
    prompt:
      "Standing before an antique hand-carved wooden haveli door with brass details set in a weathered lime-plaster wall, soft open shade light — authentic old-city location.",
  },
  {
    id: "jaali-light",
    tone: ["#f2efe9", "#bfb8ad"],
    group: "Heritage",
    label: "Marble jaali light",
    prompt:
      "Inside a white-marble pavilion with intricate jaali lattice screens casting soft patterned light, cool marble floor, serene and luxurious heritage setting.",
  },
  {
    id: "old-city-street",
    tone: ["#d4a87a", "#7d5a3c"],
    group: "Heritage",
    label: "Old-city lane",
    prompt:
      "Quiet, clean old-city lane with tall weathered facades, wooden balconies and warm late-afternoon light, softly blurred depth — editorial street location, no crowds.",
  },

  // Interiors
  {
    id: "marble-foyer",
    tone: ["#efece7", "#b8b2a7"],
    group: "Interiors",
    label: "Marble foyer",
    prompt:
      "Elegant marble foyer interior with diffused window light, subtle architectural depth, boutique campaign feel.",
  },
  {
    id: "boutique",
    tone: ["#d9c9b6", "#9b8670"],
    group: "Interiors",
    label: "Boutique interior",
    prompt:
      "Warm boutique interior with muted walls, soft directional light, and understated luxury — not a flat studio sweep.",
  },
  {
    id: "luxury-lounge",
    tone: ["#e7dccd", "#a89380"],
    group: "Interiors",
    label: "Luxury living room",
    prompt:
      "Refined contemporary living room with warm neutral walls, a sculptural sofa, brass accents and large windows with sheer curtains — soft natural daylight, real luxury home interior.",
  },
  {
    id: "grand-staircase",
    tone: ["#ece6dc", "#a99f8e"],
    group: "Interiors",
    label: "Grand staircase",
    prompt:
      "Grand curved marble staircase with a polished brass banister in a luxurious entrance hall, soft overhead and window light — elegant, spacious real interior.",
  },
  {
    id: "sunlit-verandah",
    tone: ["#e9cfa8", "#b07a4f"],
    group: "Interiors",
    label: "Sunlit verandah",
    prompt:
      "Shaded colonial-style verandah with white columns, terracotta tiles and potted palms, warm sunlight streaming in at an angle — relaxed real location.",
  },
  {
    id: "atelier",
    tone: ["#f0ebe3", "#c2b8a8"],
    group: "Interiors",
    label: "Design atelier",
    prompt:
      "Bright fashion atelier with tall windows, linen-covered work tables, fabric rolls and dress forms softly blurred in the background — authentic designer-studio setting.",
  },

  // Outdoors
  {
    id: "garden",
    tone: ["#b8c9a0", "#5e7547"],
    group: "Outdoors",
    label: "Garden path",
    prompt:
      "Quiet garden path with greenery bokeh, soft morning light, and a dress-compatible natural backdrop.",
  },
  {
    id: "rose-garden",
    tone: ["#e7c3c0", "#6f8a5a"],
    group: "Outdoors",
    label: "Rose garden",
    prompt:
      "Formal rose garden with clipped hedges and soft-coloured blooms, gentle golden morning light, creamy background blur — romantic real outdoor location.",
  },
  {
    id: "terrace",
    tone: ["#e8b98a", "#7a5a6b"],
    group: "Outdoors",
    label: "Evening terrace",
    prompt:
      "Warm evening terrace with city-soft blur in the distance, golden-hour light, and real photographic depth.",
  },
  {
    id: "rooftop-golden",
    tone: ["#f0c98d", "#a3623f"],
    group: "Outdoors",
    label: "Rooftop golden hour",
    prompt:
      "Elegant rooftop at golden hour with a low parapet, warm sun flare low in the frame and a softly blurred skyline — luxurious real campaign light.",
  },
  {
    id: "palm-courtyard",
    tone: ["#eef0ea", "#7f9a6d"],
    group: "Outdoors",
    label: "Palm courtyard & fountain",
    prompt:
      "Sunlit Mediterranean-style courtyard with tall palms, a small stone fountain and white walls, crisp natural light and soft shadows — resort campaign location.",
  },
  {
    id: "lawn-estate",
    tone: ["#c7d4b0", "#6c8455"],
    group: "Outdoors",
    label: "Estate lawn",
    prompt:
      "Manicured green lawn of a grand estate with mature trees and a classic white facade softly blurred behind, gentle overcast light — timeless luxury outdoor setting.",
  },
] as const satisfies ReadonlyArray<{
  id: string;
  /** Two colours that evoke the location — picker tile gradient only. */
  tone: readonly [string, string];
  group: StudioBackgroundGroup;
  label: string;
  prompt: string;
}>;

export type StudioBackgroundPresetId =
  (typeof STUDIO_BACKGROUND_PRESETS)[number]["id"];

/** Presets grouped for <optgroup> menus, in group order. */
export function groupedStudioBackgrounds() {
  return STUDIO_BACKGROUND_GROUPS.map((group) => ({
    group,
    presets: STUDIO_BACKGROUND_PRESETS.filter((p) => p.group === group),
  }));
}

export function resolveStudioBackgroundPrompt(input: {
  presetId?: string | null;
  custom?: string | null;
}): string {
  const custom = input.custom?.trim();
  if (custom) return custom;
  const preset = STUDIO_BACKGROUND_PRESETS.find((p) => p.id === input.presetId);
  return (
    preset?.prompt ??
    STUDIO_BACKGROUND_PRESETS.find((p) => p.id === "courtyard")!.prompt
  );
}
