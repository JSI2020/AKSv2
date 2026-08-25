"use server";

import { revalidatePath } from "next/cache";

import { db, insertAuditLog } from "@aks/db";
import { uuidv7 } from "@aks/shared";
import { requirePermission } from "@/modules/auth";
import { transition } from "@/modules/platform/transition";

import {
  deleteAnnouncement,
  listAnnouncementsAdmin,
  upsertAnnouncement,
} from "./announcements";
import {
  deleteCategoryGate,
  deleteHeroSlide,
  getOrCreateDraftHomepage,
  listCategoryTilesAdmin,
  listFeaturedBlocksAdmin,
  listHeroSlidesAdmin,
  publishCategoryGate,
  publishDraftHomepage,
  publishHeroSlide,
  saveFeaturedAndSections,
} from "./homepage";
import { countPublishedDesignsForCategory } from "./design-refs";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";
import {
  CONTENT_PAGE_ALLOW,
  getContentList,
  listContentPagesAdmin,
  upsertContentList,
  upsertContentPage,
  getContentPageById,
} from "./pages";
import {
  deleteNavItem,
  listNavItemsAdmin,
  upsertNavItem,
} from "./nav";
import { getSiteSettings, upsertSiteSettings } from "./site-settings";
import type { ContentListItem, SiteSettingsPublic } from "./types";

type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveSiteSettingsAction(
  value: SiteSettingsPublic,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("settings.edit");
    const before = await getSiteSettings();
    await upsertSiteSettings(value);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.site_settings.update",
      entityType: "site_settings",
      entityId: null,
      before,
      after: value,
    });
    revalidatePath("/");
    revalidatePath("/admin/content");
    revalidatePath("/admin/content/settings");
    revalidatePath("/admin/settings/storefront");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function loadSiteSettingsAction(): Promise<SiteSettingsPublic> {
  await requirePermission("settings.view");
  return getSiteSettings();
}

export async function saveAnnouncementAction(input: {
  id?: string;
  message: string;
  linkType: string;
  linkValue: string;
  active: boolean;
  sortOrder: number;
  startsAt: string;
  endsAt: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requirePermission("content.edit");
    const id = await upsertAnnouncement({
      id: input.id,
      message: input.message.trim(),
      link:
        input.linkValue.trim().length > 0
          ? { type: input.linkType || "url", value: input.linkValue.trim() }
          : null,
      active: input.active,
      sortOrder: input.sortOrder,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
    });
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.announcement.upsert",
      entityType: "announcement",
      entityId: id,
      before: null,
      after: { message: input.message },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/announcements");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteAnnouncementAction(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.delete");
    await deleteAnnouncement(id);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.announcement.delete",
      entityType: "announcement",
      entityId: id,
      before: null,
      after: null,
    });
    revalidatePath("/");
    revalidatePath("/admin/content/announcements");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function listAnnouncementsAction() {
  await requirePermission("content.view");
  return listAnnouncementsAdmin();
}

export async function publishHeroSlideAction(input: {
  id?: string;
  mode: "design" | "photo";
  linkedDesignId: string | null;
  headline: string;
  eyebrow: string;
  subtext: string;
  desktopImageAssetId: string | null;
  sortOrder: number;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();

    let desktopImageAssetId = input.desktopImageAssetId;
    let buttonLink: { type: string; value: string } = {
      type: "none",
      value: "",
    };
    let linkedDesignId: string | null = null;

    if (input.mode === "design" && input.linkedDesignId) {
      linkedDesignId = input.linkedDesignId;
      buttonLink = { type: "design", value: input.linkedDesignId };
      const { designs } = await import("@aks/db");
      const { eq } = await import("drizzle-orm");
      const [d] = await db
        .select({ ogAssetId: designs.ogAssetId })
        .from(designs)
        .where(eq(designs.id, input.linkedDesignId))
        .limit(1);
      if (d?.ogAssetId) desktopImageAssetId = d.ogAssetId;
    }

    const id = await publishHeroSlide({
      draftHomepageId: draft.id,
      slide: {
        id: input.id,
        homepageId: draft.id,
        eyebrow: input.eyebrow,
        headline: input.headline,
        subtext: input.subtext,
        buttonLabel: input.mode === "design" ? "Shop the style" : "",
        buttonLink,
        textPosition: "LEFT",
        overlayStrength: 40,
        sortOrder: input.sortOrder,
        active: true,
        desktopImageAssetId,
        mobileImageAssetId: null,
        videoAssetId: null,
        linkedDesignId,
        startsAt: null,
        endsAt: null,
      },
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.hero.publish",
      entityType: "hero_slide",
      entityId: id,
      before: null,
      after: { headline: input.headline, mode: input.mode },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteHeroSlideAction(
  slideId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();
    await deleteHeroSlide({ draftHomepageId: draft.id, slideId });
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.hero.delete",
      entityType: "hero_slide",
      entityId: slideId,
      before: null,
      after: null,
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function publishCategoryGateAction(input: {
  id?: string;
  categoryKey: string;
  displayName: string;
  caption: string;
  imageAssetId: string | null;
  sortOrder: number;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();
    const publishedDesignCount = await countPublishedDesignsForCategory(
      input.categoryKey,
    );

    const house = HOUSE_COLLECTIONS.find(
      (c) =>
        c.tag === input.categoryKey.toUpperCase() ||
        c.slug === input.categoryKey.toLowerCase(),
    );
    const linkValue = house?.slug ?? input.categoryKey.toLowerCase();

    const id = await publishCategoryGate({
      draftHomepageId: draft.id,
      publishedDesignCount,
      tile: {
        id: input.id,
        homepageId: draft.id,
        categoryKey: house?.tag ?? input.categoryKey.toUpperCase(),
        displayName: input.displayName,
        caption: input.caption,
        imageAssetId: input.imageAssetId,
        link: { type: "collection", value: linkValue },
        sortOrder: input.sortOrder,
        active: true,
      },
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.gate.publish",
      entityType: "category_tile",
      entityId: id,
      before: null,
      after: { displayName: input.displayName, publishedDesignCount },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteCategoryGateAction(
  tileId: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();
    await deleteCategoryGate({ draftHomepageId: draft.id, tileId });
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.gate.delete",
      entityType: "category_tile",
      entityId: tileId,
      before: null,
      after: null,
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function saveFeaturedOrderAction(input: {
  designIds: string[];
  editBlockId?: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();
    const blocks = await listFeaturedBlocksAdmin(draft.id);
    const statement = blocks.find((b) => b.kind === "STATEMENT");
    await saveFeaturedAndSections({
      draftHomepageId: draft.id,
      sectionsOrder: draft.sectionsOrder,
      sectionsEnabled: draft.sectionsEnabled,
      editBlockId: input.editBlockId ?? blocks.find((b) => b.kind === "EDIT")?.id,
      designIds: input.designIds,
      statementBlockId: statement?.id,
      statement:
        typeof statement?.payload.text === "string"
          ? statement.payload.text
          : "",
    });
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.featured.save",
      entityType: "homepage",
      entityId: draft.id,
      before: null,
      after: { designIds: input.designIds },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function saveHomepageSectionsAction(input: {
  sectionsOrder: string[];
  sectionsEnabled: Record<string, boolean>;
  statement: string;
  editMode: "auto" | "handpicked";
  editDesignIds: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const draft = await getOrCreateDraftHomepage();
    const blocks = await listFeaturedBlocksAdmin(draft.id);
    const designIds = input.editDesignIds
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    await saveFeaturedAndSections({
      draftHomepageId: draft.id,
      sectionsOrder: input.sectionsOrder,
      sectionsEnabled: input.sectionsEnabled,
      editBlockId: blocks.find((b) => b.kind === "EDIT")?.id,
      designIds,
      statementBlockId: blocks.find((b) => b.kind === "STATEMENT")?.id,
      statement: input.statement,
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.homepage.sections",
      entityType: "homepage",
      entityId: draft.id,
      before: null,
      after: { sectionsOrder: input.sectionsOrder },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function publishHomepageAction(): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.publish");
    const id = await publishDraftHomepage(session.user.id);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.homepage.publish",
      entityType: "homepage",
      entityId: id,
      before: { status: "DRAFT" },
      after: { status: "PUBLISHED" },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/homepage");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function loadHomepageAdminAction() {
  await requirePermission("content.view");
  const draft = await getOrCreateDraftHomepage();
  const [heroes, tiles, blocks] = await Promise.all([
    listHeroSlidesAdmin(draft.id),
    listCategoryTilesAdmin(draft.id),
    listFeaturedBlocksAdmin(draft.id),
  ]);
  return { draft, heroes, tiles, blocks };
}

export async function saveContentPageAction(input: {
  id?: string;
  slug: string;
  title: string;
  body: string;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requirePermission("content.edit");
    const id = await upsertContentPage(input);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.page.upsert",
      entityType: "content_page",
      entityId: id,
      before: null,
      after: { slug: input.slug, title: input.title },
    });
    revalidatePath("/admin/content/pages");
    revalidatePath(`/${input.slug}`);
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function publishContentPageAction(
  id: string,
): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.publish");
    const page = await getContentPageById(id);
    if (!page) return { ok: false, error: "Not found" };

    await db.transaction(async (tx) => {
      await transition({
        entity: "content_page",
        id,
        from: page.status,
        to: "PUBLISHED",
        actor: { id: session.user.id, role: session.user.role },
        allowList: CONTENT_PAGE_ALLOW,
        tx,
      });
    });

    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.page.publish",
      entityType: "content_page",
      entityId: id,
      before: { status: page.status },
      after: { status: "PUBLISHED" },
    });
    revalidatePath(`/${page.slug}`);
    revalidatePath("/admin/content/pages");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function listContentPagesAction() {
  await requirePermission("content.view");
  return listContentPagesAdmin();
}

export async function saveContentListAction(input: {
  key: string;
  itemsJson: string;
}): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.edit");
    const items = JSON.parse(input.itemsJson) as ContentListItem[];
    await upsertContentList(input.key, items);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.list.upsert",
      entityType: "content_list",
      entityId: null,
      before: null,
      after: { key: input.key, count: items.length },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/lists");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function loadContentListAction(key: string) {
  await requirePermission("content.view");
  return getContentList(key);
}

export async function saveNavItemAction(input: {
  id?: string;
  area: "HEADER" | "FOOTER";
  columnKey: string;
  label: string;
  linkType: string;
  linkValue: string;
  sortOrder: number;
  active: boolean;
}): Promise<ActionResult & { id?: string }> {
  try {
    const session = await requirePermission("content.edit");
    const id = await upsertNavItem({
      id: input.id,
      area: input.area,
      columnKey: input.columnKey || null,
      label: input.label,
      link: { type: input.linkType, value: input.linkValue },
      sortOrder: input.sortOrder,
      active: input.active,
    });
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.nav.upsert",
      entityType: "nav_item",
      entityId: id,
      before: null,
      after: { label: input.label },
    });
    revalidatePath("/");
    revalidatePath("/admin/content/nav");
    return { ok: true, id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function deleteNavItemAction(id: string): Promise<ActionResult> {
  try {
    const session = await requirePermission("content.delete");
    await deleteNavItem(id);
    await insertAuditLog(db, {
      id: uuidv7(),
      actorId: session.user.id,
      actorRole: session.user.role,
      action: "content.nav.delete",
      entityType: "nav_item",
      entityId: id,
      before: null,
      after: null,
    });
    revalidatePath("/");
    revalidatePath("/admin/content/nav");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Failed" };
  }
}

export async function listNavAction() {
  await requirePermission("content.view");
  return listNavItemsAdmin();
}
