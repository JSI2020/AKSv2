import Link from "next/link";

import { Eyebrow } from "@/modules/ui";
import { requirePermission } from "@/modules/auth";
import { HomepageAdmin } from "@/modules/content/admin/homepage-admin";
import {
  countPublishedDesignsForCategory,
  listPublishedDesignOptions,
} from "@/modules/content/design-refs";
import {
  getOrCreateDraftHomepage,
  listCategoryTilesAdmin,
  listFeaturedBlocksAdmin,
  listHeroSlidesAdmin,
} from "@/modules/content/homepage";

export default async function HomepageContentPage() {
  await requirePermission("content.view");
  const draft = await getOrCreateDraftHomepage();
  const [heroes, tiles, blocks, publishedDesigns] = await Promise.all([
    listHeroSlidesAdmin(draft.id),
    listCategoryTilesAdmin(draft.id),
    listFeaturedBlocksAdmin(draft.id),
    listPublishedDesignOptions(),
  ]);

  const tilesWithCounts = await Promise.all(
    tiles.map(async (t) => ({
      ...t,
      publishedDesignCount: await countPublishedDesignsForCategory(
        t.categoryKey,
      ),
    })),
  );

  return (
    <div>
      <Link
        href="/admin/content"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← Content & Settings
      </Link>
      <Eyebrow className="mt-4 text-ink/55">Content · Homepage</Eyebrow>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Homepage
      </h1>
      <p className="mt-2 text-[13px] text-ink/55">
        The welcome screen, the gates into the shop, and what&apos;s featured
        below.
      </p>
      <HomepageAdmin
        draft={{
          id: draft.id,
          sectionsOrder: draft.sectionsOrder,
          sectionsEnabled: draft.sectionsEnabled,
        }}
        heroes={heroes.map((h) => ({
          id: h.id,
          eyebrow: h.eyebrow,
          headline: h.headline,
          subtext: h.subtext,
          sortOrder: h.sortOrder,
          active: h.active,
          desktopImageAssetId: h.desktopImageAssetId,
          linkedDesignId: h.linkedDesignId,
        }))}
        tiles={tilesWithCounts}
        blocks={blocks}
        publishedDesigns={publishedDesigns}
      />
    </div>
  );
}
