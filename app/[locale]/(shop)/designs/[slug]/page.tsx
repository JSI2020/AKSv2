import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import {
  DesignConfigurator,
  DesignDetailBreadcrumb,
  getDesignBySlug,
  resolveDesignSizeChart,
  resolveImages,
} from "@/modules/catalog";
import type {
  DesignDetailPublic,
  GalleryAngle,
  ResolvedGalleryImages,
  SizeMode,
} from "@/modules/catalog";
import { houseSizeRangeCopy } from "@/modules/catalog/types";
import { DesignViewTracker } from "@/modules/analytics";
import { RelatedDesigns } from "@/modules/catalog/related-designs";
import {
  formatLeadTimeLine,
  getSiteSettings,
} from "@/modules/content/site-settings";
import { resolveShadePriceMinor } from "@/modules/designs/shade-utils";
import { JsonLd, productJsonLd } from "@/modules/seo/json-ld";
import { pageMetadata, productMetaTitle } from "@/modules/seo/metadata";
import { metaDescription } from "@/modules/seo/site";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function galleryImageUrls(images: ResolvedGalleryImages): string[] {
  const urls: string[] = [];
  for (const angle of ["FRONT", "THREE_QUARTER", "BACK"] as const) {
    const url = images[angle]?.url;
    if (url) urls.push(url);
  }
  for (const photo of images.fabricPhotos) {
    if (photo.url) urls.push(photo.url);
  }
  return urls;
}

function unitsOnHand(design: DesignDetailPublic): number {
  let total = 0;
  for (const bySize of Object.values(design.rtwAvailability)) {
    for (const qty of Object.values(bySize)) total += qty;
  }
  return total;
}

function productDescription(design: DesignDetailPublic, max?: number): string {
  const authored = houseSizeRangeCopy(
    design.seoDescription?.trim() ||
      design.description?.trim() ||
      design.storyCopy?.trim() ||
      "",
  ).trim();
  const category = design.garmentCategory.name.trim();
  const text =
    authored ||
    (category
      ? `${design.name}, ${category} — ready-to-wear from AKS-Atelier.`
      : `${design.name} — ready-to-wear from AKS-Atelier.`);
  const clean = text.replace(/\s+/g, " ").trim();
  return max ? metaDescription(clean, max) : clean;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const design = await getDesignBySlug(slug);
  if (!design) {
    return pageMetadata({
      title: "Piece not found",
      description: "That piece is not in the AKS-Atelier shop.",
      path: `/designs/${slug}`,
      noindex: true,
    });
  }
  const images = await resolveImages(design.id, design.defaultColourwayId);
  const hero =
    images.FRONT ?? images.THREE_QUARTER ?? images.BACK ?? images.fabricPhotos[0];
  return pageMetadata({
    title: productMetaTitle(design.seoTitle, design.name),
    description: productDescription(design, 160),
    path: `/designs/${design.slug}`,
    image: hero?.url,
    imageAlt: hero?.altText || design.name,
  });
}

export default async function DesignDetailPage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const design = await getDesignBySlug(slug);
  if (!design) notFound();

  const rawParams = await searchParams;
  const colourway = firstParam(rawParams.colourway) ?? null;
  const angle = (firstParam(rawParams.angle) ?? "FRONT") as GalleryAngle;
  const sizeMode = (firstParam(rawParams.sizeMode) ??
    "STANDARD") as SizeMode;
  const sizeLabel = firstParam(rawParams.sizeLabel) ?? null;
  const qtyRaw = firstParam(rawParams.qty);
  const quantity = qtyRaw ? Math.max(1, Number(qtyRaw) || 1) : 1;

  const imagesByColourway: Record<
    string,
    Awaited<ReturnType<typeof resolveImages>>
  > = {};
  await Promise.all(
    design.colourways.map(async (cw) => {
      imagesByColourway[cw.id] = await resolveImages(design.id, cw.id);
    }),
  );

  const sizeChart = await resolveDesignSizeChart({
    sizeBlockId: design.sizeBlockId,
    pieceSizeBlocks: design.pieceSizeBlocks,
    components: design.components,
    primaryCategoryKey: design.garmentCategory.key,
    availableSizeLabels: design.availableSizeLabels,
  });

  const settings = await getSiteSettings();
  const leadTimePromise = formatLeadTimeLine(
    settings,
    design.leadTimeDaysOverride,
  );
  const defaultColourway =
    design.colourways.find((cw) => cw.id === design.defaultColourwayId) ??
    design.colourways[0];
  const priceMinor = defaultColourway
    ? resolveShadePriceMinor(defaultColourway, design)
    : design.basePriceMinor;
  const imageUrls = design.colourways.flatMap((cw) =>
    galleryImageUrls(imagesByColourway[cw.id] ?? {
      FRONT: null,
      THREE_QUARTER: null,
      BACK: null,
      fabricPhotos: [],
    }),
  );

  return (
    <main className="pdp-page">
      <JsonLd
        data={productJsonLd({
          name: design.name,
          description: productDescription(design) || null,
          slug: design.slug,
          sku: design.itemNumber,
          imageUrls,
          priceMinor,
          comingSoon: design.comingSoon,
          unitsOnHand: unitsOnHand(design),
          breadcrumb: [
            {
              name: design.collectionBreadcrumb.label,
              path: `/collections/${design.collectionBreadcrumb.slug}`,
            },
          ],
        })}
      />
      <DesignViewTracker
        designId={design.id}
        designSlug={design.slug}
        designName={design.name}
      />
      <DesignDetailBreadcrumb design={design} />
      <DesignConfigurator
        design={design}
        sizeChart={sizeChart}
        imagesByColourway={imagesByColourway}
        initialColourwayParam={colourway}
        initialAngle={angle}
        initialSizeMode={sizeMode}
        initialSizeLabel={sizeLabel}
        initialQuantity={quantity}
        leadTimePromise={leadTimePromise}
        whatsappUrl={settings.whatsappUrl || undefined}
      />
      <RelatedDesigns design={design} />
    </main>
  );
}
