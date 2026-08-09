import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";

import { auth } from "@/auth";
import { Link } from "@/i18n/routing";
import { getDesignBySlug } from "@/modules/catalog";
import { MeasureFlow, loadMeasureFlowSession } from "@/modules/measure";
import { getOrSetAnonToken } from "@/modules/measure/anon-cookie";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function DesignMeasurePage({ params }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const design = await getDesignBySlug(slug);
  if (!design) notFound();

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const anonToken = userId ? null : await getOrSetAnonToken();

  const flowState = await loadMeasureFlowSession({
    designSlug: slug,
    userId,
    anonToken,
  });
  if (!flowState) notFound();

  return (
    <main className="mx-auto max-w-[640px] px-4 py-16 md:px-10">
      <p className="mb-8">
        <Link
          href={`/designs/${slug}`}
          className="text-[12px] uppercase tracking-[0.08em] text-ink/60"
        >
          ← Back to {design.name}
        </Link>
      </p>
      <MeasureFlow
        initialState={flowState}
        isSignedIn={Boolean(userId)}
      />
    </main>
  );
}
