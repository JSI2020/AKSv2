import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { houseSizeRangeCopy } from "@/modules/catalog/types";
import { getPublishedPage } from "@/modules/content/pages";
import { pageMetadata } from "@/modules/seo/metadata";
import { metaDescription } from "@/modules/seo/site";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) {
    return pageMetadata({
      title: "Page not found",
      description: "That page is not on the AKS-Atelier shop.",
      path: `/pages/${slug}`,
      noindex: true,
    });
  }
  const body = houseSizeRangeCopy(page.body);
  return pageMetadata({
    title: page.title,
    description: body.trim()
      ? metaDescription(body)
      : `${page.title} — AKS-Atelier.`,
    path: `/pages/${page.slug}`,
  });
}

export default async function ContentPageRoute({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  // Reserved shop routes — do not steal
  const reserved = new Set([
    "collections",
    "designs",
    "fabrics",
    "cart",
    "checkout",
    "account",
    "size-guide",
    "measure",
  ]);
  if (reserved.has(slug)) notFound();

  const page = await getPublishedPage(slug);
  if (!page) notFound();
  const body = houseSizeRangeCopy(page.body);

  return (
    <main className="mx-auto max-w-[720px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <h1 className="serif text-[clamp(2rem,4vw,2.8rem)] font-light leading-none">
        {page.title}
      </h1>
      <div
        className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed"
        style={{ color: "var(--espresso)" }}
      >
        {body}
      </div>
    </main>
  );
}
