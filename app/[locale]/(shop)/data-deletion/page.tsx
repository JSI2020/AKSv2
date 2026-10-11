import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { dataDeletionDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";

export const metadata: Metadata = {
  title: "Delete your data — AKS",
};

type Props = { params: Promise<{ locale: string }> };

export default async function DataDeletionPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={dataDeletionDocument} />;
}
