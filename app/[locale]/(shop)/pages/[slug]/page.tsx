import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { getPublishedPage } from "@/modules/content/pages";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

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

  return (
    <main className="mx-auto max-w-[720px] px-[2.5rem] pb-24 pt-28 max-[900px]:px-[1.4rem]">
      <h1 className="serif text-[clamp(2rem,4vw,2.8rem)] font-light leading-none">
        {page.title}
      </h1>
      <div
        className="mt-8 whitespace-pre-wrap text-[15px] leading-relaxed"
        style={{ color: "var(--espresso)" }}
      >
        {page.body}
      </div>
    </main>
  );
}
