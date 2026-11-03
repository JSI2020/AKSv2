import { setRequestLocale } from "next-intl/server";

import { termsDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";
import { pageMetadata } from "@/modules/seo/metadata";

export const metadata = pageMetadata({
  title: "Terms of service",
  description:
    "Terms for buying ready-to-wear from AKS-Atelier. Prices are in Pakistani rupees. Delivery is within Pakistan.",
  path: "/terms",
});

type Props = { params: Promise<{ locale: string }> };

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={termsDocument} />;
}
