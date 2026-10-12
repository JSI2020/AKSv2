import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { termsDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";

export const metadata: Metadata = {
  title: "Terms of service — AKS",
};

type Props = { params: Promise<{ locale: string }> };

export default async function TermsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={termsDocument} />;
}
