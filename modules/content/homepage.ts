import "server-only";

import { and, asc, eq } from "drizzle-orm";

import {
  assets,
  categoryTiles,
  db,
  featuredBlocks,
  heroSlides,
  homepageEvents,
  homepages,
} from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { createPresignedReadUrl } from "@/modules/platform/assets/r2";
import {
  registerEntityTransitions,
  type TransitionAllowList,
} from "@/modules/platform/transition";

import { resolveContentLink } from "./links";
import {
  DEFAULT_SECTIONS_ORDER,
  type CategoryTilePublic,
  type FeaturedEditPublic,
  type FeaturedLookPublic,
  type HeroSlidePublic,
  type HomepagePublic,
} from "./types";

export const HOMEPAGE_TRANSITION_ALLOW: TransitionAllowList = {
  DRAFT: ["PUBLISHED"],
  PUBLISHED: ["DRAFT"],
};

let registered = false;

export function registerHomepageTransitions(): void {
  if (registered) return;
  registered = true;
  registerEntityTransitions("homepage", {
    applyStatusChange: async (tx, id, from, to) => {
      const patch: {
        status: "DRAFT" | "PUBLISHED";
        updatedAt: Date;
        publishedAt?: Date | null;
      } = {
        status: to as "DRAFT" | "PUBLISHED",
        updatedAt: new Date(),
      };
      if (to === "PUBLISHED") patch.publishedAt = new Date();
      if (to === "DRAFT") patch.publishedAt = null;

      const rows = await tx
        .update(homepages)
        .set(patch)
        .where(
          and(
            eq(homepages.id, id),
            eq(homepages.status, from as "DRAFT" | "PUBLISHED"),
          ),
        )
        .returning({ id: homepages.id });
      return rows.length;
    },
    insertEvent: async (tx, row) => {
      await tx.insert(homepageEvents).values(row);
    },
  });
}

registerHomepageTransitions();

async function assetUrl(assetId: string | null): Promise<string | null> {
  if (!assetId) return null;
  const rows = await db
    .select({ r2Key: assets.r2Key })
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  const key = rows[0]?.r2Key;
  if (!key) return null;
  try {
    return await createPresignedReadUrl(key, 3600);
  } catch {
    return null;
  }
}

function inWindow(startsAt: Date | null, endsAt: Date | null, now: Date) {
  const afterStart = !startsAt || startsAt.getTime() <= now.getTime();
  const beforeEnd = !endsAt || endsAt.getTime() >= now.getTime();
  return afterStart && beforeEnd;
}

export async function getOrCreateDraftHomepage() {
  const existing = await db
    .select()
    .from(homepages)
    .where(eq(homepages.status, "DRAFT"))
    .limit(1);
  if (existing[0]) return existing[0];

  const id = uuidv7();
  await db.insert(homepages).values({
    id,
    status: "DRAFT",
    sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
    sectionsEnabled: {},
  });
  const created = await db
    .select()
    .from(homepages)
    .where(eq(homepages.id, id))
    .limit(1);
  return created[0]!;
}

export async function getPublishedHomepageRow() {
  const rows = await db
    .select()
    .from(homepages)
    .where(eq(homepages.status, "PUBLISHED"))
    .limit(1);
  return rows[0] ?? null;
}

export async function loadHomepageBundle(
  homepageId: string,
): Promise<HomepagePublic> {
  const [home] = await db
    .select()
    .from(homepages)
    .where(eq(homepages.id, homepageId))
    .limit(1);
  if (!home) {
    return {
      sectionsOrder: [...DEFAULT_SECTIONS_ORDER],
      sectionsEnabled: {},
      heroes: [],
      tiles: [],
      statement: null,
      edit: { mode: "auto", designIds: [] },
      look: null,
    };
  }

  const now = new Date();
  const slides = await db
    .select()
    .from(heroSlides)
    .where(eq(heroSlides.homepageId, homepageId))
    .orderBy(asc(heroSlides.sortOrder));

  const heroes: HeroSlidePublic[] = [];
  for (const s of slides) {
    if (!s.active || !inWindow(s.startsAt, s.endsAt, now)) continue;
    heroes.push({
      id: s.id,
      eyebrow: s.eyebrow,
      headline: s.headline,
      subtext: s.subtext,
      buttonLabel: s.buttonLabel,
      buttonHref: resolveContentLink(s.buttonLink),
      textPosition: s.textPosition,
      overlayStrength: s.overlayStrength,
      desktopImageUrl: await assetUrl(s.desktopImageAssetId),
      mobileImageUrl: await assetUrl(s.mobileImageAssetId),
      videoUrl: await assetUrl(s.videoAssetId),
    });
  }

  const tileRows = await db
    .select()
    .from(categoryTiles)
    .where(
      and(eq(categoryTiles.homepageId, homepageId), eq(categoryTiles.active, true)),
    )
    .orderBy(asc(categoryTiles.sortOrder));

  const tiles: CategoryTilePublic[] = [];
  for (const t of tileRows) {
    tiles.push({
      id: t.id,
      categoryKey: t.categoryKey,
      displayName: t.displayName,
      caption: t.caption,
      href: t.link
        ? resolveContentLink(t.link)
        : `/collections/${t.categoryKey}`,
      imageUrl: await assetUrl(t.imageAssetId),
    });
  }

  const blocks = await db
    .select()
    .from(featuredBlocks)
    .where(eq(featuredBlocks.homepageId, homepageId))
    .orderBy(asc(featuredBlocks.sortOrder));

  let statement: string | null = null;
  let edit: FeaturedEditPublic = { mode: "auto", designIds: [] };
  let look: FeaturedLookPublic = null;

  for (const b of blocks) {
    if (b.kind === "STATEMENT") {
      const text = b.payload.text;
      if (typeof text === "string") statement = text;
    }
    if (b.kind === "EDIT") {
      const mode = b.payload.mode === "handpicked" ? "handpicked" : "auto";
      const designIds = Array.isArray(b.payload.designIds)
        ? (b.payload.designIds as string[])
        : [];
      edit = { mode, designIds };
    }
    if (b.kind === "LOOK") {
      const designId = b.payload.designId;
      const story = b.payload.story;
      if (typeof designId === "string") {
        look = {
          designId,
          story: typeof story === "string" ? story : "",
        };
      }
    }
  }

  return {
    sectionsOrder: home.sectionsOrder?.length
      ? home.sectionsOrder
      : [...DEFAULT_SECTIONS_ORDER],
    sectionsEnabled: home.sectionsEnabled ?? {},
    heroes,
    tiles,
    statement,
    edit,
    look,
  };
}

export async function loadStorefrontHomepage(): Promise<HomepagePublic | null> {
  const published = await getPublishedHomepageRow();
  if (!published) return null;
  return loadHomepageBundle(published.id);
}

export async function updateHomepageSections(input: {
  homepageId: string;
  sectionsOrder: string[];
  sectionsEnabled: Record<string, boolean>;
}): Promise<void> {
  await db
    .update(homepages)
    .set({
      sectionsOrder: input.sectionsOrder,
      sectionsEnabled: input.sectionsEnabled,
      updatedAt: new Date(),
    })
    .where(eq(homepages.id, input.homepageId));
}

export async function upsertHeroSlide(input: {
  id?: string;
  homepageId: string;
  eyebrow: string;
  headline: string;
  subtext: string;
  buttonLabel: string;
  buttonLink: { type: string; value: string };
  textPosition: "LEFT" | "CENTRE";
  overlayStrength: number;
  sortOrder: number;
  active: boolean;
  desktopImageAssetId: string | null;
  mobileImageAssetId: string | null;
  videoAssetId: string | null;
  linkedDesignId: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  const buttonLink = {
    type: input.buttonLink.type as
      | "collection"
      | "design"
      | "page"
      | "url"
      | "hash"
      | "none",
    value: input.buttonLink.value,
  };
  const values = {
    homepageId: input.homepageId,
    eyebrow: input.eyebrow,
    headline: input.headline,
    subtext: input.subtext,
    buttonLabel: input.buttonLabel,
    buttonLink,
    textPosition: input.textPosition,
    overlayStrength: input.overlayStrength,
    sortOrder: input.sortOrder,
    active: input.active,
    desktopImageAssetId: input.desktopImageAssetId,
    mobileImageAssetId: input.mobileImageAssetId,
    videoAssetId: input.videoAssetId,
    linkedDesignId: input.linkedDesignId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    updatedAt: new Date(),
  };

  if (input.id) {
    await db.update(heroSlides).set(values).where(eq(heroSlides.id, id));
  } else {
    await db.insert(heroSlides).values({ id, ...values });
  }
  return id;
}

export async function listHeroSlidesAdmin(homepageId: string) {
  return db
    .select()
    .from(heroSlides)
    .where(eq(heroSlides.homepageId, homepageId))
    .orderBy(asc(heroSlides.sortOrder));
}

export async function upsertCategoryTile(input: {
  id?: string;
  homepageId: string;
  categoryKey: string;
  displayName: string;
  caption: string;
  imageAssetId: string | null;
  link: { type: string; value: string } | null;
  sortOrder: number;
  active: boolean;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  const link = input.link
    ? {
        type: input.link.type as
          | "collection"
          | "design"
          | "page"
          | "url"
          | "hash"
          | "none",
        value: input.link.value,
      }
    : null;
  const values = {
    homepageId: input.homepageId,
    categoryKey: input.categoryKey,
    displayName: input.displayName,
    caption: input.caption,
    imageAssetId: input.imageAssetId,
    link,
    sortOrder: input.sortOrder,
    active: input.active,
    updatedAt: new Date(),
  };
  if (input.id) {
    await db.update(categoryTiles).set(values).where(eq(categoryTiles.id, id));
  } else {
    await db.insert(categoryTiles).values({ id, ...values });
  }
  return id;
}

export async function listCategoryTilesAdmin(homepageId: string) {
  return db
    .select()
    .from(categoryTiles)
    .where(eq(categoryTiles.homepageId, homepageId))
    .orderBy(asc(categoryTiles.sortOrder));
}

export async function upsertFeaturedBlock(input: {
  id?: string;
  homepageId: string;
  kind: "EDIT" | "LOOK" | "STATEMENT";
  payload: Record<string, unknown>;
  sortOrder: number;
}): Promise<string> {
  const id = input.id ?? uuidv7();
  if (input.id) {
    await db
      .update(featuredBlocks)
      .set({
        payload: input.payload,
        sortOrder: input.sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(featuredBlocks.id, id));
  } else {
    await db.insert(featuredBlocks).values({
      id,
      homepageId: input.homepageId,
      kind: input.kind,
      payload: input.payload,
      sortOrder: input.sortOrder,
    });
  }
  return id;
}

export async function listFeaturedBlocksAdmin(homepageId: string) {
  return db
    .select()
    .from(featuredBlocks)
    .where(eq(featuredBlocks.homepageId, homepageId))
    .orderBy(asc(featuredBlocks.sortOrder));
}

async function ensurePublishedHomepage() {
  let published = await getPublishedHomepageRow();
  if (published) return published;
  const draft = await getOrCreateDraftHomepage();
  const id = uuidv7();
  await db.insert(homepages).values({
    id,
    status: "PUBLISHED",
    sectionsOrder: draft.sectionsOrder,
    sectionsEnabled: draft.sectionsEnabled,
    publishedAt: new Date(),
  });
  return (await getPublishedHomepageRow())!;
}

/** Save draft slide and mirror that one slide onto published (by sortOrder). */
export async function publishHeroSlide(input: {
  draftHomepageId: string;
  slide: Parameters<typeof upsertHeroSlide>[0];
}): Promise<string> {
  const draftId = await upsertHeroSlide({
    ...input.slide,
    homepageId: input.draftHomepageId,
  });
  const [draftSlide] = await db
    .select()
    .from(heroSlides)
    .where(eq(heroSlides.id, draftId))
    .limit(1);
  if (!draftSlide) throw new Error("Slide missing after save");

  const published = await ensurePublishedHomepage();
  const publishedSlides = await listHeroSlidesAdmin(published.id);
  const mirror = publishedSlides.find(
    (s) => s.sortOrder === draftSlide.sortOrder,
  );

  const payload = {
    eyebrow: draftSlide.eyebrow,
    headline: draftSlide.headline,
    subtext: draftSlide.subtext,
    buttonLabel: draftSlide.buttonLabel,
    buttonLink: draftSlide.buttonLink,
    textPosition: draftSlide.textPosition,
    overlayStrength: draftSlide.overlayStrength,
    sortOrder: draftSlide.sortOrder,
    active: draftSlide.active,
    desktopImageAssetId: draftSlide.desktopImageAssetId,
    mobileImageAssetId: draftSlide.mobileImageAssetId,
    videoAssetId: draftSlide.videoAssetId,
    linkedDesignId: draftSlide.linkedDesignId,
    startsAt: draftSlide.startsAt,
    endsAt: draftSlide.endsAt,
    homepageId: published.id,
  };

  if (mirror) {
    await upsertHeroSlide({
      id: mirror.id,
      ...payload,
      buttonLink: payload.buttonLink,
    });
  } else {
    await upsertHeroSlide({
      ...payload,
      buttonLink: payload.buttonLink,
    });
  }
  return draftId;
}

export async function deleteHeroSlide(input: {
  draftHomepageId: string;
  slideId: string;
}): Promise<void> {
  const [slide] = await db
    .select()
    .from(heroSlides)
    .where(eq(heroSlides.id, input.slideId))
    .limit(1);
  if (!slide || slide.homepageId !== input.draftHomepageId) {
    throw new Error("Slide not found");
  }
  await db.delete(heroSlides).where(eq(heroSlides.id, input.slideId));
  const published = await getPublishedHomepageRow();
  if (published) {
    await db
      .delete(heroSlides)
      .where(
        and(
          eq(heroSlides.homepageId, published.id),
          eq(heroSlides.sortOrder, slide.sortOrder),
        ),
      );
  }
}

/** Save draft gate and mirror onto published when publishAllowed. */
export async function publishCategoryGate(input: {
  draftHomepageId: string;
  tile: Parameters<typeof upsertCategoryTile>[0];
  publishedDesignCount: number;
}): Promise<string> {
  if (input.publishedDesignCount < 1) {
    throw new Error(
      "No published design yet — link one in Designs before publishing this gate.",
    );
  }
  const draftId = await upsertCategoryTile({
    ...input.tile,
    homepageId: input.draftHomepageId,
    active: true,
  });
  const [draftTile] = await db
    .select()
    .from(categoryTiles)
    .where(eq(categoryTiles.id, draftId))
    .limit(1);
  if (!draftTile) throw new Error("Gate missing after save");

  const published = await ensurePublishedHomepage();
  const publishedTiles = await listCategoryTilesAdmin(published.id);
  const mirror = publishedTiles.find(
    (t) => t.sortOrder === draftTile.sortOrder,
  );

  const payload = {
    categoryKey: draftTile.categoryKey,
    displayName: draftTile.displayName,
    caption: draftTile.caption,
    imageAssetId: draftTile.imageAssetId,
    link: draftTile.link,
    sortOrder: draftTile.sortOrder,
    active: true,
    homepageId: published.id,
  };

  if (mirror) {
    await upsertCategoryTile({ id: mirror.id, ...payload });
  } else {
    await upsertCategoryTile(payload);
  }
  return draftId;
}

export async function deleteCategoryGate(input: {
  draftHomepageId: string;
  tileId: string;
}): Promise<void> {
  const [tile] = await db
    .select()
    .from(categoryTiles)
    .where(eq(categoryTiles.id, input.tileId))
    .limit(1);
  if (!tile || tile.homepageId !== input.draftHomepageId) {
    throw new Error("Gate not found");
  }
  await db.delete(categoryTiles).where(eq(categoryTiles.id, input.tileId));
  const published = await getPublishedHomepageRow();
  if (published) {
    await db
      .delete(categoryTiles)
      .where(
        and(
          eq(categoryTiles.homepageId, published.id),
          eq(categoryTiles.sortOrder, tile.sortOrder),
        ),
      );
  }
}

/** Save featured EDIT block + sections onto draft and published. */
export async function saveFeaturedAndSections(input: {
  draftHomepageId: string;
  sectionsOrder: string[];
  sectionsEnabled: Record<string, boolean>;
  editBlockId?: string;
  designIds: string[];
  statementBlockId?: string;
  statement: string;
}): Promise<void> {
  await updateHomepageSections({
    homepageId: input.draftHomepageId,
    sectionsOrder: input.sectionsOrder,
    sectionsEnabled: input.sectionsEnabled,
  });

  await upsertFeaturedBlock({
    id: input.editBlockId,
    homepageId: input.draftHomepageId,
    kind: "EDIT",
    payload: {
      mode: "handpicked",
      designIds: input.designIds,
    },
    sortOrder: 0,
  });

  await upsertFeaturedBlock({
    id: input.statementBlockId,
    homepageId: input.draftHomepageId,
    kind: "STATEMENT",
    payload: { text: input.statement },
    sortOrder: 1,
  });

  const published = await ensurePublishedHomepage();
  await updateHomepageSections({
    homepageId: published.id,
    sectionsOrder: input.sectionsOrder,
    sectionsEnabled: input.sectionsEnabled,
  });

  const pubBlocks = await listFeaturedBlocksAdmin(published.id);
  const pubEdit = pubBlocks.find((b) => b.kind === "EDIT");
  const pubStatement = pubBlocks.find((b) => b.kind === "STATEMENT");

  await upsertFeaturedBlock({
    id: pubEdit?.id,
    homepageId: published.id,
    kind: "EDIT",
    payload: { mode: "handpicked", designIds: input.designIds },
    sortOrder: 0,
  });
  await upsertFeaturedBlock({
    id: pubStatement?.id,
    homepageId: published.id,
    kind: "STATEMENT",
    payload: { text: input.statement },
    sortOrder: 1,
  });
}

/**
 * Publish: copy draft children onto published row (create published if needed),
 * then mark published via transition semantics on the published entity.
 */
export async function publishDraftHomepage(actorId: string): Promise<string> {
  const draft = await getOrCreateDraftHomepage();
  let published = await getPublishedHomepageRow();

  if (!published) {
    const id = uuidv7();
    await db.insert(homepages).values({
      id,
      status: "PUBLISHED",
      sectionsOrder: draft.sectionsOrder,
      sectionsEnabled: draft.sectionsEnabled,
      publishedAt: new Date(),
    });
    published = (await getPublishedHomepageRow())!;
  } else {
    await db
      .update(homepages)
      .set({
        sectionsOrder: draft.sectionsOrder,
        sectionsEnabled: draft.sectionsEnabled,
        publishedAt: new Date(),
        updatedAt: new Date(),
        status: "PUBLISHED",
      })
      .where(eq(homepages.id, published.id));
  }

  // Replace children on published
  await db.delete(heroSlides).where(eq(heroSlides.homepageId, published.id));
  await db
    .delete(categoryTiles)
    .where(eq(categoryTiles.homepageId, published.id));
  await db
    .delete(featuredBlocks)
    .where(eq(featuredBlocks.homepageId, published.id));

  const [slides, tiles, blocks] = await Promise.all([
    listHeroSlidesAdmin(draft.id),
    listCategoryTilesAdmin(draft.id),
    listFeaturedBlocksAdmin(draft.id),
  ]);

  for (const s of slides) {
    await db.insert(heroSlides).values({
      ...s,
      id: uuidv7(),
      homepageId: published.id,
    });
  }
  for (const t of tiles) {
    await db.insert(categoryTiles).values({
      ...t,
      id: uuidv7(),
      homepageId: published.id,
    });
  }
  for (const b of blocks) {
    await db.insert(featuredBlocks).values({
      ...b,
      id: uuidv7(),
      homepageId: published.id,
    });
  }

  await db.insert(homepageEvents).values({
    id: uuidv7(),
    entityId: published.id,
    fromStatus: "DRAFT",
    toStatus: "PUBLISHED",
    actorId,
    note: "Published from draft homepage",
  });

  return published.id;
}
