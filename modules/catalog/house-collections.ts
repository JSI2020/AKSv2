/**
 * House collection merchandising copy — customer-facing.
 * Source: brand collections brief (Essentials · Tailored · Occasion · Signature · Separates).
 */

export type HouseCollectionDef = {
  /** URL slug under /collections/[slug] */
  slug: string;
  /** FREE design tag value */
  tag: string;
  /** One-word (or short) nav label */
  navLabel: string;
  /** Full title on landing */
  title: string;
  /** Tile tagline (italic on hub) */
  tagline: string;
  /** Short card blurb on hub */
  card: string;
  /** Longer landing intro */
  intro: string;
};

export const COLLECTIONS_HUB_INTRO = {
  line1: "Heritage silhouettes, quietly reimagined.",
  line2: "Cut, cloth, and colour — nothing louder than it needs to be.",
} as const;

export const HOUSE_COLLECTIONS: readonly HouseCollectionDef[] = [
  {
    slug: "essentials",
    tag: "ESSENTIALS",
    navLabel: "Essentials",
    title: "Essentials",
    tagline: "Quiet luxury for real life.",
    card: "Modest, breathable pieces for the days in between — handloom cotton, linen, and earthy tones, where the weave is the only ornament.",
    intro:
      "The pieces you'll reach for most. Cut from handloom khaddi, linen, and cotton-silk in warm, easy neutrals, Essentials is everyday dressing made quietly luxurious — modest, comfortable, and finished with the same care as everything we make. No embroidery, no noise. Just beautiful cloth and a clean line.",
  },
  {
    slug: "tailored",
    tag: "TAILORED",
    navLabel: "Tailored",
    title: "Modern Tailored",
    tagline: "East, cut by the West.",
    card: "Structured silhouettes — the vest, the duster, the wide-leg trouser — on eastern foundations. The fusion lives in the tailoring.",
    intro:
      "Where heritage meets a sharper line. Longline vests, duster coats, tailored trousers, and jumpsuits, drafted with couture precision and carried in deep, jewel-toned colour. This is the wardrobe that takes her from day to evening — covered, considered, unmistakably modern. The tailoring is the statement; nothing more is needed.",
  },
  {
    slug: "occasion",
    tag: "OCCASION",
    navLabel: "Occasion",
    title: "Occasion",
    tagline: "Festive, made quiet.",
    card: "Eid, nikkah, and celebration in rich, muted colour, touched with the lightest hand of tonal embroidery.",
    intro:
      "Celebration on our own terms. Peshwaz, angrakha, and court silhouettes in rich but restrained colour — rosewood, olive, espresso — finished with the finest tonal embroidery, worked only where it belongs. Where the occasion market shouts, we let the cut and the cloth speak. Elegance you'll return to long after the season.",
  },
  {
    slug: "signature",
    tag: "SIGNATURE",
    navLabel: "Signature",
    title: "Signature",
    tagline: "The house at its purest.",
    card: "Fluid columns and pieces made to move, in the full spectrum of white. Whitework, silk, and restraint — the looks that define us.",
    intro:
      "Our defining pieces. Fluid columns and silhouettes made to move, told in the whole spectrum of white — milk, ivory, bone — and finished with whitework so quiet you feel it before you see it. Made-to-measure, editorial, and unmistakably ours. This is the house at its most considered.",
  },
  {
    slug: "separates",
    tag: "SEPARATES",
    navLabel: "Separates",
    title: "Separates",
    tagline: "The pieces beneath every look.",
    card: "Trousers, churidars, waistcoats, and hand-rolled dupattas — tonal, considered, made to build a wardrobe around.",
    intro:
      "The foundations. Cigarette trousers, wide-leg palazzos, churidars, long waistcoats, and hand-rolled dupattas — tonal and endlessly wearable, designed to move between every collection we make. Start a look here, or complete one. These are the pieces a wardrobe is built around.",
  },
] as const;

export function getHouseCollectionBySlug(
  slug: string,
): HouseCollectionDef | undefined {
  const normalized = slug.trim().toLowerCase();
  return HOUSE_COLLECTIONS.find(
    (c) => c.slug === normalized || (normalized === "white" && c.slug === "signature"),
  );
}
