import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { privacyDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";

export const metadata: Metadata = {
  title: "Privacy policy — AKS",
};

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={privacyDocument} />;
}
