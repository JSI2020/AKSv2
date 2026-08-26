import { redirect } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

// Made-to-measure ordering is retired — AKS sells standard sizes only.
// Any direct hit on the legacy measure route returns to the product page.
export default async function DesignMeasurePage({ params }: Props) {
  const { locale, slug } = await params;
  redirect({ href: `/designs/${slug}`, locale });
}
