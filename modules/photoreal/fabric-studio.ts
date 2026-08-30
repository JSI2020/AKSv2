export type FabricOutputKind = "spiral" | "flat" | "garment" | "macro";

export const FABRIC_OUTPUT_LABELS: Record<FabricOutputKind, string> = {
  spiral: "SPIRAL",
  flat: "FLAT LAY",
  garment: "ON GARMENT",
  macro: "MACRO",
};

/** House colourways for catalogue spiral-drape sheets (matches brand neutrals + accents). */
export const HOUSE_FABRIC_COLORWAYS = [
  { id: "white", label: "White", prompt: "bright white" },
  { id: "ivory", label: "Ivory", prompt: "warm ivory" },
  { id: "sand", label: "Sand", prompt: "sand beige" },
  { id: "taupe", label: "Taupe", prompt: "greige taupe" },
  { id: "mustard", label: "Mustard", prompt: "muted mustard gold" },
  { id: "rust", label: "Rust", prompt: "burnt orange rust" },
  { id: "lime", label: "Lime", prompt: "soft lime green" },
  { id: "olive", label: "Olive", prompt: "muted olive green" },
  { id: "maroon", label: "Maroon", prompt: "deep burgundy maroon" },
  { id: "sky", label: "Sky", prompt: "soft cerulean blue" },
  { id: "slate", label: "Slate", prompt: "slate blue grey" },
  { id: "charcoal", label: "Charcoal", prompt: "charcoal grey" },
  { id: "black", label: "Black", prompt: "deep black" },
] as const;

export function fabricCataloguePrompt(opts: {
  lighting: string;
  background: string;
  swatchDescription?: string | null;
}): string {
  const light = opts.lighting.toLowerCase();
  const bg = opts.background.toLowerCase();
  const analysis = opts.swatchDescription?.trim();

  return [
    "The attached image is the ONLY source of truth for this textile.",
    analysis
      ? `Swatch analysis (must match exactly): ${analysis}.`
      : "Match the swatch colour and weave exactly as photographed.",
    "TASK: rearrange the SAME physical fabric into one flat spiral/concentric drape, photographed from directly above, square format.",
    "COLOUR LOCK: identical hue, saturation, lightness, and warm/cool bias to the reference swatch. Do NOT re-white-balance, warm-shift, desaturate, or push grey toward beige/brown/cream unless the swatch already is.",
    "WEAVE LOCK: identical weave pattern, grain, and surface texture — only the fold layout may change.",
    `Presentation: ${light} even lighting that reveals weave without tinting the cloth; ${bg} surface behind the fabric with NO colour cast onto the textile.`,
    "Improve styling and sharpness only — not the textile colour or material.",
    "No people, logos, text, garment shapes, or new fabric.",
  ].join(" ");
}

export function spiralDrapePrompt(opts: {
  lighting: string;
  background: string;
  colorNote?: string;
}): string {
  const light = opts.lighting.toLowerCase();
  const bg = opts.background.toLowerCase();
  const color = opts.colorNote
    ? `Recolor the textile to ${opts.colorNote} while keeping the exact same weave, grain and surface texture as the reference swatch. `
    : "Preserve the exact colour, weave and texture of the reference swatch. ";
  return (
    `${color}Professional square catalogue fabric photograph: the cloth arranged in an elegant spiral or concentric drape pattern viewed from above, ` +
    `soft natural shadows revealing weave texture, ${light} lighting, ${bg} background, fashion fabric catalogue quality. ` +
    `No people, no logos, no text, no garment — fabric swatch only.`
  );
}

export function fabricPrompt(
  kind: FabricOutputKind,
  opts: { garment: string; lighting: string; background: string },
): string {
  const light = opts.lighting.toLowerCase();
  const bg = opts.background.toLowerCase();
  switch (kind) {
    case "spiral":
      return spiralDrapePrompt(opts);
    case "flat":
      return `Professional flat-lay photograph of this exact fabric swatch arranged in a gentle spiral on a ${bg} surface. ${light} lighting. Sharp weave detail, true colour, catalogue quality.`;
    case "garment":
      return `Professional catalogue photograph showing this exact fabric made into a modest ${opts.garment.toLowerCase()}, draped on an invisible mannequin form. ${light} lighting. ${bg} background. Preserve textile colour and weave.`;
    case "macro":
      return `Extreme macro close-up photograph of this fabric's weave and texture. ${light} lighting. Sharp detail, true colour and sheen.`;
  }
}
