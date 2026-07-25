import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getDesignBySlug } from "@/modules/catalog";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function DesignMeasureStubPage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const design = await getDesignBySlug(slug);
  if (!design) notFound();

  return (
    <main className="mx-auto max-w-[640px] px-4 py-16 md:px-10">
      <p className="mb-3 text-[12px] uppercase tracking-[0.1em] text-madder">
        Made to measure
      </p>
      <h1 className="mb-4 font-display text-[32px] font-medium leading-tight">
        {design.name}
      </h1>
      <p className="text-[15px] leading-relaxed text-ink/75">
        Tell us your measurements and watch the fit change. This flow arrives in
        the next step — for now, return to the design page to choose a standard
        size or open the size guide.
      </p>
    </main>
  );
}
