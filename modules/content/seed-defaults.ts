import { eq } from "drizzle-orm";

import {
  categoryTiles,
  contentLists,
  contentPages,
  db,
  featuredBlocks,
  heroSlides,
  homepages,
  navItems,
  siteSettings,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";

import {
  collectionLink,
  DEFAULT_SECTIONS_ORDER,
  DEFAULT_SITE_SETTINGS,
  hashLink,
  pageLink,
} from "./types";

const CONSTRUCTION_ITEMS = [
  "Cut by hand from natural cloth",
  "Panels and flare cut into the cloth — never gathered on",
  "Deep, softly curved hems, so the garment carries weight and hangs true",
  "Covered fabric fastenings, matched to the cloth — never metal",
  "Invisible finishing, inside and out — the seam is part of the design",
  "Standard house sizes, cut to a considered fit",
];

/**
 * Idempotent seed: site settings, draft+published homepage with prototype
 * copy, four doors, statement, construction list, default nav, atelier page.
 */
export async function seedContentDefaults(): Promise<void> {
  const existingSettings = await db
    .select({ key: siteSettings.key })
    .from(siteSettings)
    .where(eq(siteSettings.key, "storefront"))
    .limit(1);
  if (!existingSettings[0]) {
    await db.insert(siteSettings).values({
      key: "storefront",
      value: { ...DEFAULT_SITE_SETTINGS },
    });
  }

  let draft = (
    await db
      .select()
      .from(homepages)
      .where(eq(homepages.status, "DRAFT"))
      .limit(1)
  )[0];

  if (!draft) {
    const draftId = uuidv7();
    await db.insert(homepages).values({
      id: draftId,
      status: "DRAFT",
      sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
      sectionsEnabled: {},
    });
    draft = (
      await db.select().from(homepages).where(eq(homepages.id, draftId)).limit(1)
    )[0]!;
  }

  const slideCount = await db
    .select({ id: heroSlides.id })
    .from(heroSlides)
    .where(eq(heroSlides.homepageId, draft.id))
    .limit(1);

  if (!slideCount[0]) {
    await db.insert(heroSlides).values({
      id: uuidv7(),
      homepageId: draft.id,
      eyebrow: "Quiet luxury · rooted in heritage",
      headline: "The cut is the *ornament*.",
      subtext:
        "Heritage silhouettes in matte natural cloth — refined by proportion, drape and finishing. Nothing added to be seen; everything made to be felt.",
      buttonLabel: "Enter the house",
      buttonLink: hashLink("#cats"),
      textPosition: "LEFT",
      overlayStrength: 45,
      sortOrder: 0,
      active: true,
    });
  }

  const tileCount = await db
    .select({ id: categoryTiles.id })
    .from(categoryTiles)
    .where(eq(categoryTiles.homepageId, draft.id))
    .limit(1);

  if (!tileCount[0]) {
    const doors = [
      {
        key: "ESSENTIALS",
        name: "Essentials",
        caption: "Everyday · khaddi & cotton silk",
        slug: "essentials",
      },
      {
        key: "TAILORED",
        name: "Tailored",
        caption: "Structured · clean line",
        slug: "tailored",
      },
      {
        key: "OCCASION",
        name: "Occasion",
        caption: "Restrained · covered",
        slug: "occasion",
      },
      {
        key: "SIGNATURE",
        name: "Signature",
        caption: "The statement pieces",
        slug: "signature",
      },
    ];
    for (let i = 0; i < doors.length; i++) {
      const d = doors[i]!;
      await db.insert(categoryTiles).values({
        id: uuidv7(),
        homepageId: draft.id,
        categoryKey: d.key,
        displayName: d.name,
        caption: d.caption,
        link: collectionLink(d.slug),
        sortOrder: i,
        active: true,
      });
    }
  }

  const blockCount = await db
    .select({ id: featuredBlocks.id })
    .from(featuredBlocks)
    .where(eq(featuredBlocks.homepageId, draft.id))
    .limit(1);

  if (!blockCount[0]) {
    await db.insert(featuredBlocks).values([
      {
        id: uuidv7(),
        homepageId: draft.id,
        kind: "STATEMENT",
        payload: {
          text: "The market signals value through what it *adds*. We signal it through what remains — *proportion, drape, and finishing*. Unmistakably Pakistani in silhouette, contemporary and covered in cut.",
        },
        sortOrder: 0,
      },
      {
        id: uuidv7(),
        homepageId: draft.id,
        kind: "EDIT",
        payload: { mode: "auto", designIds: [] },
        sortOrder: 1,
      },
    ]);
  }

  // Mirror draft → published if no published row
  let published = (
    await db
      .select()
      .from(homepages)
      .where(eq(homepages.status, "PUBLISHED"))
      .limit(1)
  )[0];

  if (!published) {
    const publishedId = uuidv7();
    await db.insert(homepages).values({
      id: publishedId,
      status: "PUBLISHED",
      sectionsOrder: draft.sectionsOrder,
      sectionsEnabled: draft.sectionsEnabled,
      publishedAt: new Date(),
    });

    const slides = await db
      .select()
      .from(heroSlides)
      .where(eq(heroSlides.homepageId, draft.id));
    for (const s of slides) {
      await db.insert(heroSlides).values({
        ...s,
        id: uuidv7(),
        homepageId: publishedId,
      });
    }
    const tiles = await db
      .select()
      .from(categoryTiles)
      .where(eq(categoryTiles.homepageId, draft.id));
    for (const t of tiles) {
      await db.insert(categoryTiles).values({
        ...t,
        id: uuidv7(),
        homepageId: publishedId,
      });
    }
    const blocks = await db
      .select()
      .from(featuredBlocks)
      .where(eq(featuredBlocks.homepageId, draft.id));
    for (const b of blocks) {
      await db.insert(featuredBlocks).values({
        ...b,
        id: uuidv7(),
        homepageId: publishedId,
      });
    }
    published = (
      await db
        .select()
        .from(homepages)
        .where(eq(homepages.id, publishedId))
        .limit(1)
    )[0];
  }

  const navCount = await db.select({ id: navItems.id }).from(navItems).limit(1);
  if (!navCount[0]) {
    const header = [
      { label: "Shop", link: hashLink("#cats"), order: 0 },
      { label: "The Edit", link: hashLink("#edit"), order: 1 },
      { label: "Fabric", link: pageLink("fabrics"), order: 2 },
      { label: "Atelier", link: hashLink("#making"), order: 3 },
    ];
    for (const h of header) {
      await db.insert(navItems).values({
        id: uuidv7(),
        area: "HEADER",
        label: h.label,
        link: h.link,
        sortOrder: h.order,
        active: true,
      });
    }
    const footerShop = [
      ["Essentials", "essentials"],
      ["Tailored", "tailored"],
      ["Occasion", "occasion"],
      ["Signature", "signature"],
    ] as const;
    for (let i = 0; i < footerShop.length; i++) {
      const [label, slug] = footerShop[i]!;
      await db.insert(navItems).values({
        id: uuidv7(),
        area: "FOOTER",
        columnKey: "shop",
        label,
        link: collectionLink(slug),
        sortOrder: i,
        active: true,
      });
    }
    const footerAtelier = [
      { label: "Ready to wear", link: pageLink("size-guide"), order: 0 },
      { label: "Fabric library", link: pageLink("fabrics"), order: 1 },
      { label: "Size & fit", link: pageLink("size-guide"), order: 2 },
      { label: "Our story", link: pageLink("atelier"), order: 3 },
    ];
    for (const f of footerAtelier) {
      await db.insert(navItems).values({
        id: uuidv7(),
        area: "FOOTER",
        columnKey: "atelier",
        label: f.label,
        link: f.link,
        sortOrder: f.order,
        active: true,
      });
    }
  }

  const list = await db
    .select()
    .from(contentLists)
    .where(eq(contentLists.key, "CONSTRUCTION"))
    .limit(1);
  if (!list[0]) {
    await db.insert(contentLists).values({
      id: uuidv7(),
      key: "CONSTRUCTION",
      items: CONSTRUCTION_ITEMS.map((text) => ({ id: uuidv7(), text })),
    });
  }

  for (const page of [
    {
      slug: "atelier",
      title: "Atelier / Our story",
      body: "Cut by hand, in natural cloth.\n\nConstruction is the product: hidden pockets, covered fabric buttons, deep curved hems, panels cut into the cloth and never gathered on. Cut by hand, finished with care, made to outlast the season.\n\nThe fusion lives in the line, never a logo.",
    },
    {
      slug: "construction",
      title: "Construction principles (the six-line list)",
      body: CONSTRUCTION_ITEMS.map((line, i) => `${i + 1}. ${line}`).join("\n"),
    },
    {
      slug: "size-guide",
      title: "Size & fit guide — intro copy",
      body: "How we fit — standard house sizes and made-to-measure. Edit this intro in Content → Pages.",
    },
    {
      slug: "faq",
      title: "FAQ",
      body: "Content coming soon — edit this page in Content → Pages.",
    },
    {
      slug: "shipping-returns",
      title: "Shipping & returns",
      body: "Content coming soon — edit this page in Content → Pages.",
    },
    {
      slug: "privacy-terms",
      title: "Privacy & terms",
      body: "Content coming soon — edit this page in Content → Pages.",
    },
  ] as const) {
    const existing = await db
      .select({ id: contentPages.id })
      .from(contentPages)
      .where(eq(contentPages.slug, page.slug))
      .limit(1);
    if (!existing[0]) {
      await db.insert(contentPages).values({
        id: uuidv7(),
        slug: page.slug,
        title: page.title,
        body: page.body,
        status: "PUBLISHED",
        publishedAt: new Date(),
      });
    }
  }
}
