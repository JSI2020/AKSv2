/**
 * Soft-launch catalogue: 10 looks × 5 house collections.
 * Published only via modules/designs/catalogue-writer (admin publish path).
 */

export type HouseTag =
  | "ESSENTIALS"
  | "TAILORED"
  | "OCCASION"
  | "SIGNATURE"
  | "SEPARATES";

export type CatalogueLook = {
  category: "KAMEEZ" | "TROUSER" | "GOWN" | "DUPATTA" | "SKIRT";
  name: string;
  story: string;
  occasion: string;
  pricePkr: number;
  houseTag: HouseTag;
  featured?: boolean;
  swatchIndex: number;
  work?: "PLAIN" | "EMBROIDERED";
  extraFreeTags?: string[];
};

/** Fashion hexes — neutrals for Signature/Essentials/Separates; deeper for Tailored/Occasion */
export const CATALOGUE_SWATCHES: { name: string; slug: string; hex: string }[] = [
  { name: "Milk", slug: "milk", hex: "#F4EEE1" },
  { name: "Ivory", slug: "ivory", hex: "#EAE1CF" },
  { name: "Bone", slug: "bone", hex: "#DDD2BC" },
  { name: "Oyster", slug: "oyster", hex: "#CDC0A8" },
  { name: "Sand", slug: "sand", hex: "#BFAA88" },
  { name: "Stone", slug: "stone", hex: "#A89A80" },
  { name: "Taupe", slug: "taupe", hex: "#8D7E66" },
  { name: "Tea Rose", slug: "tea-rose", hex: "#C6A59B" },
  { name: "Antique Gold", slug: "antique-gold", hex: "#9A8A6B" },
  { name: "Soft Olive", slug: "soft-olive", hex: "#7C7C58" },
  { name: "Dusty Clay", slug: "dusty-clay", hex: "#AE7A61" },
  { name: "Espresso", slug: "espresso", hex: "#4A3B2F" },
  { name: "Oxblood", slug: "oxblood", hex: "#6B3A3A" },
  { name: "Deep Olive", slug: "deep-olive", hex: "#3D3E32" },
  { name: "Ink", slug: "ink-fashion", hex: "#2B2926" },
];

const PIECES_PER_COLLECTION = 10;

function padLooks(
  houseTag: HouseTag,
  base: Omit<CatalogueLook, "houseTag">[],
): CatalogueLook[] {
  if (base.length !== PIECES_PER_COLLECTION) {
    throw new Error(
      `${houseTag}: expected ${PIECES_PER_COLLECTION} looks, got ${base.length}`,
    );
  }
  return base.map((look) => ({ ...look, houseTag }));
}

const ESSENTIALS = padLooks("ESSENTIALS", [
  {
    category: "KAMEEZ",
    name: "Khaddi Everyday Kurta",
    story:
      "Handloom texture in an easy neutral — the weave is the only ornament.",
    occasion: "EVERYDAY",
    pricePkr: 24_000,
    swatchIndex: 4,
    featured: true,
  },
  {
    category: "KAMEEZ",
    name: "Linen Soft Shirt",
    story: "Washed linen that ages quietly — modest, breathable, for real life.",
    occasion: "CASUAL",
    pricePkr: 22_000,
    swatchIndex: 5,
  },
  {
    category: "KAMEEZ",
    name: "Cotton-Silk Day Kurta",
    story: "Gentle drape in warm neutrals — finished with the same care as everything we make.",
    occasion: "EVERYDAY",
    pricePkr: 26_000,
    swatchIndex: 3,
  },
  {
    category: "TROUSER",
    name: "Easy Palazzo",
    story: "Soft fall in earthy tone — the days-in-between trouser.",
    occasion: "CASUAL",
    pricePkr: 18_000,
    swatchIndex: 6,
  },
  {
    category: "TROUSER",
    name: "Straight Khaddi Shalwar",
    story: "Handloom cotton, clean line — no embroidery, no noise.",
    occasion: "EVERYDAY",
    pricePkr: 16_000,
    swatchIndex: 4,
  },
  {
    category: "DUPATTA",
    name: "Mulmul Soft Dupatta",
    story: "Airy muslin for everyday layering — texture over decoration.",
    occasion: "EVERYDAY",
    pricePkr: 9_000,
    swatchIndex: 1,
  },
  {
    category: "DUPATTA",
    name: "Linen Edge Dupatta",
    story: "Matte linen border on a quiet ground — completes an Essentials look.",
    occasion: "CASUAL",
    pricePkr: 11_000,
    swatchIndex: 5,
  },
  {
    category: "KAMEEZ",
    name: "Relaxed Office Kurta",
    story: "Covered, considered, breathable — for desks that still ask for composure.",
    occasion: "OFFICE",
    pricePkr: 25_000,
    swatchIndex: 7,
  },
  {
    category: "SKIRT",
    name: "A-Line Soft Skirt",
    story: "Earthy tone, clean sweep — everyday dressing made quietly considered.",
    occasion: "EVERYDAY",
    pricePkr: 19_000,
    swatchIndex: 4,
  },
  {
    category: "KAMEEZ",
    name: "Tea Rose Soft Tunic",
    story: "A muted warm accent on handloom — still no surface noise.",
    occasion: "CASUAL",
    pricePkr: 23_000,
    swatchIndex: 7,
  },
]);

const TAILORED = padLooks("TAILORED", [
  {
    category: "KAMEEZ",
    name: "Longline Vest Kurta",
    story: "Structured silhouette on an eastern foundation — the fusion lives in the cut.",
    occasion: "OFFICE",
    pricePkr: 34_000,
    swatchIndex: 11,
    featured: true,
  },
  {
    category: "KAMEEZ",
    name: "Duster Overlay",
    story: "A longer line for day to evening — covered, sharp, unmistakably modern.",
    occasion: "SEMI_FORMAL",
    pricePkr: 38_000,
    swatchIndex: 14,
  },
  {
    category: "TROUSER",
    name: "Wide-Leg Tailored Trouser",
    story: "East, cut by the West — architectural fall in deep tone.",
    occasion: "OFFICE",
    pricePkr: 28_000,
    swatchIndex: 13,
  },
  {
    category: "TROUSER",
    name: "Cigarette Tailored Pant",
    story: "Slim precision — the statement is the tailoring alone.",
    occasion: "OFFICE",
    pricePkr: 26_000,
    swatchIndex: 12,
  },
  {
    category: "GOWN",
    name: "Column Jumpsuit",
    story: "One unbroken line — couture precision without surface clutter.",
    occasion: "EVENING",
    pricePkr: 45_000,
    swatchIndex: 14,
  },
  {
    category: "KAMEEZ",
    name: "Jewel Waistcoat Set",
    story: "Deep colour, sharp shoulder — wardrobe that moves from day to evening.",
    occasion: "SEMI_FORMAL",
    pricePkr: 36_000,
    swatchIndex: 12,
  },
  {
    category: "TROUSER",
    name: "Panelled Court Trouser",
    story: "Architectural panels — structure as ornament.",
    occasion: "FORMAL",
    pricePkr: 30_000,
    swatchIndex: 11,
  },
  {
    category: "KAMEEZ",
    name: "Ash Blue Soft Blazer Kurta",
    story: "Muted jewel tone on a tailored body — nothing more is needed.",
    occasion: "OFFICE",
    pricePkr: 35_000,
    swatchIndex: 9,
  },
  {
    category: "DUPATTA",
    name: "Structured Organza Stole",
    story: "Crisp sheer for tailored looks — holds its own shape.",
    occasion: "SEMI_FORMAL",
    pricePkr: 14_000,
    swatchIndex: 14,
  },
  {
    category: "KAMEEZ",
    name: "Oxblood Long Shirt",
    story: "Deep anchor colour, clean overlap — eastern cut, western restraint.",
    occasion: "EVENING",
    pricePkr: 32_000,
    swatchIndex: 12,
  },
]);

const OCCASION = padLooks("OCCASION", [
  {
    category: "GOWN",
    name: "Modern Peshwaz",
    story:
      "High empire seam for celebration — rich but restrained, cut speaking first.",
    occasion: "EID",
    pricePkr: 48_000,
    swatchIndex: 7,
    featured: true,
    work: "EMBROIDERED",
  },
  {
    category: "KAMEEZ",
    name: "Heritage Angrakha",
    story: "Clean overlap, inside tie — composure for nikkah and quiet evenings.",
    occasion: "NIKAH",
    pricePkr: 42_000,
    swatchIndex: 11,
    work: "EMBROIDERED",
  },
  {
    category: "GOWN",
    name: "Court Farshi Pair",
    story: "Regal coverage with a soft pool — festive, made quiet.",
    occasion: "WEDDING_GUEST",
    pricePkr: 52_000,
    swatchIndex: 8,
    work: "EMBROIDERED",
  },
  {
    category: "KAMEEZ",
    name: "Rosewood Soft Kurta",
    story: "Muted celebration colour — tonal work only where it belongs.",
    occasion: "FESTIVE",
    pricePkr: 36_000,
    swatchIndex: 10,
    work: "EMBROIDERED",
  },
  {
    category: "KAMEEZ",
    name: "Olive Evening Angrakha",
    story: "Restrained olive — elegance you return to after the season.",
    occasion: "EVENING",
    pricePkr: 40_000,
    swatchIndex: 9,
    work: "EMBROIDERED",
  },
  {
    category: "TROUSER",
    name: "Regal Churidar",
    story: "Slim line under peshwaz — the quiet half of the occasion look.",
    occasion: "EID",
    pricePkr: 20_000,
    swatchIndex: 11,
  },
  {
    category: "DUPATTA",
    name: "Tonal Organza Dupatta",
    story: "Light hand of tonal embroidery — felt before it is seen.",
    occasion: "WALIMA",
    pricePkr: 16_000,
    swatchIndex: 7,
    work: "EMBROIDERED",
  },
  {
    category: "GOWN",
    name: "Espresso Soft Maxi",
    story: "Deep anchor for baraat guest — cut and cloth over shout.",
    occasion: "BARAAT",
    pricePkr: 46_000,
    swatchIndex: 11,
  },
  {
    category: "KAMEEZ",
    name: "Antique Gold Soft Shirt",
    story: "Warm muted gold — celebration without the noise.",
    occasion: "MEHNDI",
    pricePkr: 34_000,
    swatchIndex: 8,
    work: "EMBROIDERED",
  },
  {
    category: "KAMEEZ",
    name: "Tea Rose Peshwaz Top",
    story: "Soft occasion pink — where the market shouts, we let the line speak.",
    occasion: "EID",
    pricePkr: 38_000,
    swatchIndex: 7,
    work: "EMBROIDERED",
  },
]);

const SIGNATURE = padLooks("SIGNATURE", [
  {
    category: "KAMEEZ",
    name: "Seen in Motion Kurta",
    story: "Open side seams reveal the fall — fluid white, the house at its purest.",
    occasion: "EVERYDAY",
    pricePkr: 32_000,
    swatchIndex: 0,
    featured: true,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "TROUSER",
    name: "Crescent Farshi",
    story: "Trailing farshi for soft pooling — made to move with a signature kurta.",
    occasion: "EVERYDAY",
    pricePkr: 22_000,
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "GOWN",
    name: "Milk Column",
    story: "One long white line — whitework so quiet you feel it first.",
    occasion: "FORMAL",
    pricePkr: 55_000,
    swatchIndex: 0,
    work: "EMBROIDERED",
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "KAMEEZ",
    name: "Ivory Kalidaar",
    story: "Layered panels in ivory — editorial, made-to-measure spirit.",
    occasion: "SEMI_FORMAL",
    pricePkr: 44_000,
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "KAMEEZ",
    name: "Bone Soft Angrakha",
    story: "Quiet overlap in bone — Signature restraint.",
    occasion: "EVERYDAY",
    pricePkr: 36_000,
    swatchIndex: 2,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "DUPATTA",
    name: "Whitework Soft Dupatta",
    story: "Spectrum of white — milk to oyster — finished by hand.",
    occasion: "FORMAL",
    pricePkr: 15_000,
    swatchIndex: 0,
    work: "EMBROIDERED",
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "TROUSER",
    name: "Ivory Soft Palazzo",
    story: "Fluid white trouser — movement is the statement.",
    occasion: "EVERYDAY",
    pricePkr: 20_000,
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "GOWN",
    name: "Oyster Soft Farshi Set",
    story: "Double-farshi depth in oyster — no embroidery shouting.",
    occasion: "EVENING",
    pricePkr: 58_000,
    swatchIndex: 3,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "KAMEEZ",
    name: "Milk Soft Shirt",
    story: "The defining white shirt — cut and cloth only.",
    occasion: "CASUAL",
    pricePkr: 28_000,
    swatchIndex: 0,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
  {
    category: "KAMEEZ",
    name: "Ivory Open-Side Tunic",
    story: "Plain from the front — the open seam reveals the story in motion.",
    occasion: "EVERYDAY",
    pricePkr: 30_000,
    swatchIndex: 1,
    extraFreeTags: ["WHITE_COLLECTION"],
  },
]);

const SEPARATES = padLooks("SEPARATES", [
  {
    category: "TROUSER",
    name: "Cigarette Trouser",
    story: "Tonal foundation — endlessly wearable beneath every look.",
    occasion: "EVERYDAY",
    pricePkr: 18_000,
    swatchIndex: 2,
    featured: true,
  },
  {
    category: "TROUSER",
    name: "Wide-Leg Soft Palazzo",
    story: "Start a look here, or complete one — wardrobe building block.",
    occasion: "CASUAL",
    pricePkr: 19_000,
    swatchIndex: 4,
  },
  {
    category: "TROUSER",
    name: "Soft Churidar",
    story: "Slim tonal line — moves between every collection we make.",
    occasion: "EVERYDAY",
    pricePkr: 15_000,
    swatchIndex: 1,
  },
  {
    category: "KAMEEZ",
    name: "Long Soft Waistcoat",
    story: "Layering piece — considered, tonal, made to build around.",
    occasion: "EVERYDAY",
    pricePkr: 22_000,
    swatchIndex: 3,
  },
  {
    category: "DUPATTA",
    name: "Hand-Rolled Dupatta",
    story: "Sheer or soft mulmul — finished by hand, completes any shelf.",
    occasion: "EVERYDAY",
    pricePkr: 12_000,
    swatchIndex: 1,
  },
  {
    category: "DUPATTA",
    name: "Bone Soft Stole",
    story: "Quiet separate for Signature or Essentials looks alike.",
    occasion: "CASUAL",
    pricePkr: 10_000,
    swatchIndex: 2,
  },
  {
    category: "SKIRT",
    name: "Panel Soft Skirt",
    story: "Architectural panels as a foundation piece.",
    occasion: "EVERYDAY",
    pricePkr: 21_000,
    swatchIndex: 3,
  },
  {
    category: "TROUSER",
    name: "Ankle Soft Pant",
    story: "Clean hem, tonal cloth — the piece beneath every look.",
    occasion: "OFFICE",
    pricePkr: 17_000,
    swatchIndex: 5,
  },
  {
    category: "KAMEEZ",
    name: "Short Soft Waistcoat",
    story: "Cropped layer — wardrobe arithmetic, not decoration.",
    occasion: "CASUAL",
    pricePkr: 20_000,
    swatchIndex: 0,
  },
  {
    category: "DUPATTA",
    name: "Sand Soft Dupatta",
    story: "Earthy separate — designed to travel across collections.",
    occasion: "EVERYDAY",
    pricePkr: 11_000,
    swatchIndex: 4,
  },
]);

export const HOUSE_CATALOGUE_LOOKS: readonly CatalogueLook[] = [
  ...ESSENTIALS,
  ...TAILORED,
  ...OCCASION,
  ...SIGNATURE,
  ...SEPARATES,
];

export const HOUSE_COLLECTION_TAGS: readonly HouseTag[] = [
  "ESSENTIALS",
  "TAILORED",
  "OCCASION",
  "SIGNATURE",
  "SEPARATES",
];
