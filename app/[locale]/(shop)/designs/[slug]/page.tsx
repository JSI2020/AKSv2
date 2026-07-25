import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import {
  DesignConfigurator,
  DesignDetailBreadcrumb,
  getDesignBySlug,
  resolveDesignSizeChart,
  resolveImages,
} from "@/modules/catalog";
import type { GalleryAngle, SizeMode } from "@/modules/catalog";
import { resolveMeasurementProfileId } from "@/modules/cart/queries";
import { auth } from "@/auth";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";
import { DesignViewTracker } from "@/modules/analytics";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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
    components: design.components,
    primaryCategoryKey: design.garmentCategory.key,
  });

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonId = await getOrSetAnonToken();
  const measurementProfileId = await resolveMeasurementProfileId({
    designId: design.id,
    userId,
    anonId,
  });

  return (
    <main className="mx-auto max-w-[1300px] px-4 pb-28 pt-9 md:px-10">
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
        measurementProfileId={measurementProfileId}
      />
    </main>
  );
}
