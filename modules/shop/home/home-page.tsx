import { getTranslations } from "next-intl/server";
import { cloneElement, isValidElement } from "react";

import { getPublishedDesigns } from "@/modules/catalog/queries";
import { getContentList } from "@/modules/content/pages";
import { loadStorefrontHomepage } from "@/modules/content/homepage";
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

function sectionOn(
  enabled: Record<string, boolean>,
  key: string,
): boolean {
  return enabled[key] !== false;
}

export async function HomePage() {
  const t = await getTranslations("HomeProto");
  const [homepage, autoDiscounts] = await Promise.all([
    loadStorefrontHomepage(),
    loadActiveAutomaticPercentDiscounts(),
  ]);

  const editMode = homepage?.edit.mode ?? "auto";
  const handpicked = homepage?.edit.designIds ?? [];

  let designs;
  if (editMode === "handpicked" && handpicked.length > 0) {
    const all = await getPublishedDesigns({ sort: "newest", pageSize: 48 });
    const byId = new Map(all.items.map((d) => [d.id, d]));
    designs = handpicked
      .map((id) => byId.get(id))
      .filter(Boolean)
      .slice(0, 12) as typeof all.items;
  } else {
    const { items } = await getPublishedDesigns({
      sort: "newest",
      pageSize: 12,
    });
    designs = items.slice(0, 12);
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

  const statementText =
    homepage?.statement ||
    "The market signals value through what it *adds*. We signal it through what remains — *proportion, drape, and finishing*. Unmistakably Pakistani in silhouette, contemporary and covered in cut.";

  const order =
    homepage?.sectionsOrder?.length ?
      homepage.sectionsOrder
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
        eyebrow={t("catsEyebrow")}
        title={t("catsTitle")}
        slotTag={t("catSlotTag")}
        exploreTemplate={(name) => t("exploreDoor", { name })}
      />
    ),
    edit: <EditGrid designs={designs} />,
    fabric: <FabricLibrary />,
    atelier: <Atelier signatures={signatures} />,
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
