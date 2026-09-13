import { getTranslations } from "next-intl/server";
import { cloneElement, isValidElement } from "react";

import { getPublishedDesigns } from "@/modules/catalog/queries";
import { getContentList } from "@/modules/content/pages";
import { loadStorefrontHomepage } from "@/modules/content/homepage";
import { listHouseCollections } from "@/modules/catalog/house-collections-queries";
import {
  automaticPercentForDesign,
  loadActiveAutomaticPercentDiscounts,
} from "@/modules/discounts/storefront-badges";

import { Atelier } from "./atelier";
import { CategoryDoors } from "./category-doors";
import { EditGrid } from "./edit-grid";
import { FabricLibrary } from "./fabric-library";
import { HomeHero } from "./hero";
import { HomeStatement } from "./statement";

function sectionOn(enabled: Record<string, boolean>, key: string): boolean {
  return enabled[key] !== false;
}

export async function HomePage() {
  const t = await getTranslations("HomeProto");
  const [homepage, autoDiscounts, collections] = await Promise.all([
    loadStorefrontHomepage(),
    loadActiveAutomaticPercentDiscounts(),
    listHouseCollections({ activeOnly: true }),
  ]);

  const doorLabels = Object.fromEntries(
    collections.flatMap((c) => [[c.tag, c.navLabel]]),
  );
  doorLabels.WHITE_COLLECTION = "Signature";

  const editDoorFilters = collections
    .filter((c) => c.slug !== "separates")
    .slice(0, 4)
    .map((c) => ({ label: c.navLabel, tag: c.tag }));

  const editMode = homepage?.edit.mode ?? "auto";
  const handpicked = homepage?.edit.designIds ?? [];

  let designs;
  if (editMode === "handpicked" && handpicked.length > 0) {
    const { items } = await getPublishedDesigns({
      filters: { designIds: handpicked },
      sort: "newest",
      pageSize: Math.min(48, handpicked.length),
    });
    const byId = new Map(items.map((d) => [d.id, d]));
    designs = handpicked
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 12) as typeof items;
  } else {
    const { items } = await getPublishedDesigns({
      sort: "newest",
      pageSize: 48,
    });
    designs = items;
  }

  designs = designs.map((d) => ({
    ...d,
    automaticPercentOff: automaticPercentForDesign({
      designId: d.id,
      freeTags: d.freeTags,
      garmentTypeKey: d.garmentTypeKey,
      discounts: autoDiscounts,
    }),
  }));

  const construction = await getContentList("CONSTRUCTION");
  const signatures =
    construction.length > 0
      ? construction.map((c) => c.text)
      : (t.raw("signatures") as string[]);

  const statementText = homepage?.statement || t("statement");

  const order = homepage?.sectionsOrder?.length
    ? homepage.sectionsOrder
    : ["hero", "statement", "categories", "edit", "fabric", "atelier"];
  const enabled = homepage?.sectionsEnabled ?? {};

  const heroSlide = homepage?.heroes[0] ?? null;
  const tiles = homepage?.tiles ?? [];

  const heroFallback = {
    eyebrow: t("heroEyebrow"),
    line1: t("heroLine1"),
    line2: t.rich("heroLine2", {
      em: (chunks) => <em>{chunks}</em>,
    }),
    sub: t("heroSub"),
    cta: t("heroCta"),
    slotTag: t("heroSlotTag"),
    slotCap: t("heroSlotCap"),
  };

  const sections: Record<string, React.ReactNode> = {
    hero: <HomeHero slide={heroSlide} fallback={heroFallback} />,
    statement: <HomeStatement text={statementText} />,
    categories: (
      <CategoryDoors
        tiles={tiles}
        fallbackDoors={collections}
        eyebrow={t("heroEyebrow")}
        title={t("catsTitle")}
        exploreTemplate={(name) => t("exploreDoor", { name })}
      />
    ),
    edit: (
      <EditGrid
        designs={designs}
        doorFilters={editDoorFilters}
        doorLabels={doorLabels}
      />
    ),
    fabric: <FabricLibrary />,
    atelier: (
      <Atelier
        signatures={signatures}
        eyebrow={t("atelierEyebrow")}
        title={t("atelierTitle")}
        p1={t("atelierP1")}
        p2={t("atelierP2")}
        aksLine={t.rich("atelierAks", {
          em: (chunks) => <em>{chunks}</em>,
        })}
      />
    ),
  };

  return (
    <main>
      {order.map((key) => {
        if (!sectionOn(enabled, key)) return null;
        const node = sections[key];
        if (node == null) return null;
        if (!isValidElement(node)) return node;
        return cloneElement(node, { key });
      })}
    </main>
  );
}
