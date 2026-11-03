import { setRequestLocale } from "next-intl/server";

import { dataDeletionDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";
import { pageMetadata } from "@/modules/seo/metadata";

export const metadata = pageMetadata({
  title: "Delete your data",
  description:
    "How to ask AKS-Atelier to delete your account. Order records needed for the sale are kept.",
  path: "/data-deletion",
});

type Props = { params: Promise<{ locale: string }> };

export default async function DataDeletionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={dataDeletionDocument} />;
}
