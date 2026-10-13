import { eq } from "drizzle-orm";

import {
  announcements,
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
  "Panels and flare cut into the cloth – never gathered on",
  "Deep, softly curved hems, so the garment carries weight and hangs true",
  "Covered fabric fastenings, matched to the cloth – never metal",
  "Invisible finishing, inside and out – the seam is part of the design",
  "Standard house sizes, cut to a considered fit",
];

/**
 * Idempotent seed: site settings, draft+published homepage with prototype
 * copy, four doors, statement, construction list, default nav, atelier page.
 */
export async function seedContentDefaults(): Promise<void> {
  const existingSettings = await db
    .select({ key: siteSettings.key, value: siteSettings.value })
    .from(siteSettings)
    .where(eq(siteSettings.key, "storefront"))
    .limit(1);
  if (!existingSettings[0]) {
    await db.insert(siteSettings).values({
      key: "storefront",
      value: { ...DEFAULT_SITE_SETTINGS },
    });
  } else {
    const raw =
      existingSettings[0].value &&
      typeof existingSettings[0].value === "object"
        ? (existingSettings[0].value as Record<string, unknown>)
        : {};
    const merged = { ...DEFAULT_SITE_SETTINGS, ...raw };
    await db
      .update(siteSettings)
      .set({ value: merged, updatedAt: new Date() })
      .where(eq(siteSettings.key, "storefront"));
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
      eyebrow: "Quiet luxury, cut by hand",
      headline: "The cut is\nthe *ornament*.",
      subtext:
        "Eastern silhouette, Western restraint – in matte natural cloth shaped by proportion and drape. Nothing added to be seen; everything made to be felt.",
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
        caption: "The everyday, quietly elevated",
        slug: "essentials",
      },
      {
        key: "TAILORED",
        name: "Tailored",
        caption: "Structure, softened by hand",
        slug: "tailored",
      },
      {
        key: "OCCASION",
        name: "Occasion",
        caption: "Covered, and never overstated",
        slug: "occasion",
      },
      {
        key: "SIGNATURE",
        name: "Signature",
        caption: "The pieces we're known for",
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
          text: "Most labels signal value by what they *add*. We signal it by what *remains*: proportion, drape, and a finish you can only reach by hand. Pakistani in silhouette, quiet in intent – made to outlast the season it's bought in.",
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

  const announcementCount = await db
    .select({ id: announcements.id })
    .from(announcements)
    .limit(1);
  if (!announcementCount[0]) {
    await db.insert(announcements).values({
      id: uuidv7(),
      message: "Ready to wear, cut by hand · Free shipping within Pakistan",
      link: null,
      sortOrder: 0,
      active: true,
    });
  }

  const navCount = await db.select({ id: navItems.id }).from(navItems).limit(1);
  if (!navCount[0]) {
    const header = [
      { label: "Shop", link: pageLink("collections"), order: 0 },
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
      title: "Size & fit guide – intro copy",
      body: "How we fit – standard house sizes XS–XL. Edit this intro in Content → Pages.",
    },
    {
      slug: "faq",
      title: "FAQ",
      body: "Soft launch is ready-to-wear in house sizes XS–XL.\n\nCash on delivery: pay the full amount when your order arrives.\n\nWe ship within Pakistan; shipping is free on soft-launch orders. Lead time is set per design (and in storefront settings).\n\nTrack your order with the email you gave at checkout.",
    },
    {
      slug: "shipping-returns",
      title: "Shipping & returns",
      body: "We ship within Pakistan. Soft launch includes free shipping on every order — pay on delivery.\n\nUnworn pieces with tags may be returned within 7 days of delivery; message us on WhatsApp to start a return.",
    },
    {
      slug: "privacy-terms",
      title: "Privacy & terms",
      body: "We keep your order details to make and deliver your piece. We do not sell your data. Edit this page with your counsel before launch.",
    },
  ] as const) {
    const existing = await db
      .select({ id: contentPages.id, body: contentPages.body })
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
      continue;
    }

    const stale =
      existing[0].body.includes("edit before launch") ||
      existing[0].body.includes("Edit this page before launch") ||
      existing[0].body.includes("Deposit locks your piece") ||
      existing[0].body.includes("Pakistan shipping first");
    if (stale && (page.slug === "faq" || page.slug === "shipping-returns")) {
      await db
        .update(contentPages)
        .set({
          title: page.title,
          body: page.body,
          updatedAt: new Date(),
        })
        .where(eq(contentPages.id, existing[0].id));
    }
  }

  const staleAnnouncements = await db
    .select({ id: announcements.id, message: announcements.message })
    .from(announcements);
  for (const row of staleAnnouncements) {
    const lower = row.message.toLowerCase();
    const stalePrepared = lower.includes(
      "white collection and house doors are being prepared",
    );
    if (!lower.includes("worldwide") && !stalePrepared) continue;
    const message = stalePrepared
      ? "Ready to wear · ships in 14–18 days · Free shipping within Pakistan"
      : "Ready to wear, cut by hand · Free shipping within Pakistan";
    await db
      .update(announcements)
      .set({
        message,
        updatedAt: new Date(),
      })
      .where(eq(announcements.id, row.id));
  }
}
