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
  {
    id: "studio-window",
    tone: ["#f1ece4", "#cfc4b2"],
    group: "Studio",
    label: "Daylight window studio",
    prompt:
      "Bright daylight photo studio with a tall window and sheer linen curtain, soft natural side light, warm white walls and pale oak floor — airy, clean campaign set.",
  },
  {
    id: "studio-dark",
    tone: ["#4a4440", "#1f1c1a"],
    group: "Studio",
    label: "Moody dark studio",
    prompt:
      "Moody luxury studio with a deep charcoal backdrop and a soft sculpted spotlight, rich shadows and a subtle floor glow — dramatic couture campaign lighting.",
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
  {
    id: "mughal-garden",
    tone: ["#b7c79a", "#7e6a4e"],
    group: "Heritage",
    label: "Mughal garden",
    prompt:
      "Classic Mughal garden with a long central water channel, fountains, symmetrical lawns and sandstone pavilions softly blurred behind — serene heritage location in daylight.",
  },
  {
    id: "red-sandstone",
    tone: ["#c98c66", "#7a3f2a"],
    group: "Heritage",
    label: "Red sandstone courtyard",
    prompt:
      "Red sandstone Mughal courtyard with scalloped arches and inlaid white marble details, warm afternoon light and long soft shadows — grand heritage location.",
  },
  {
    id: "tiled-wall",
    tone: ["#5b88b5", "#e8e2d4"],
    group: "Heritage",
    label: "Blue tile wall",
    prompt:
      "Wall of hand-painted blue and white Multani tiles with intricate floral patterns, soft open shade light — vibrant heritage craft backdrop.",
  },
  {
    id: "haveli-staircase",
    tone: ["#b58a5f", "#5e4330"],
    group: "Heritage",
    label: "Haveli staircase",
    prompt:
      "Old haveli interior staircase with a carved wooden balustrade, lime-plaster walls and warm light falling from a high window — atmospheric heritage interior.",
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
  {
    id: "cafe-arches",
    tone: ["#e3d6c3", "#8f7a62"],
    group: "Interiors",
    label: "Café with arched windows",
    prompt:
      "Elegant café with tall arched windows, marble bistro tables, brass fittings and warm morning light — refined lifestyle location, softly blurred, no crowds.",
  },
  {
    id: "library",
    tone: ["#8a6a4a", "#3d2c1f"],
    group: "Interiors",
    label: "Classic library",
    prompt:
      "Classic private library with floor-to-ceiling wooden bookshelves, a leather armchair and warm lamplight mixed with window daylight — intellectual, luxurious setting.",
  },
  {
    id: "hotel-suite",
    tone: ["#e6dbcc", "#9c8a76"],
    group: "Interiors",
    label: "Luxury hotel suite",
    prompt:
      "Five-star hotel suite with velvet armchairs, soft neutral drapes, a large window and gentle daylight — polished luxury interior.",
  },
  {
    id: "conservatory",
    tone: ["#d7e2cf", "#6f8c64"],
    group: "Interiors",
    label: "Glass conservatory",
    prompt:
      "Victorian glass conservatory filled with lush green plants and potted palms, bright diffused daylight through the glass roof — fresh botanical interior.",
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
  {
    id: "chinar-autumn",
    tone: ["#e3a254", "#8a4b25"],
    group: "Outdoors",
    label: "Autumn chinar avenue",
    prompt:
      "Avenue of tall chinar trees in autumn with golden and rust leaves on the ground, warm low sun filtering through — romantic seasonal outdoor location.",
  },
  {
    id: "cherry-blossom",
    tone: ["#f2d4dc", "#b88a97"],
    group: "Outdoors",
    label: "Cherry blossom path",
    prompt:
      "Path lined with cherry trees in full pink blossom, petals drifting, soft spring daylight and creamy background blur — delicate romantic location.",
  },
  {
    id: "wheat-field",
    tone: ["#e9c77d", "#a67a35"],
    group: "Outdoors",
    label: "Golden wheat field",
    prompt:
      "Golden wheat field at sunset with a warm glowing horizon and soft backlight — earthy, cinematic outdoor location.",
  },
  {
    id: "mountain-valley",
    tone: ["#9fbad0", "#5e7a55"],
    group: "Outdoors",
    label: "Mountain valley",
    prompt:
      "Green northern mountain valley with snow-capped peaks in the distance, fresh clear daylight and wildflowers in the foreground — breathtaking outdoor location.",
  },
  {
    id: "lakeside",
    tone: ["#a9c4cf", "#5c6f63"],
    group: "Outdoors",
    label: "Lakeside jetty",
    prompt:
      "Calm lakeside with a wooden jetty, still reflective water and soft hills beyond, gentle early-morning light — peaceful outdoor location.",
  },
  {
    id: "modern-street",
    tone: ["#cfd1d0", "#6e7072"],
    group: "Outdoors",
    label: "Modern city street",
    prompt:
      "Clean modern city street with glass storefronts and stone pavement, soft overcast daylight and gentle urban blur — contemporary street-style location, no crowds.",
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

/** Static preview photo of the empty location (generated once, in /public). */
export function studioBackgroundPreviewSrc(id: string): string {
  return `/studio-locations/${id}.webp`;
}

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
