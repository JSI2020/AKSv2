import { setRequestLocale } from "next-intl/server";

import { privacyDocument } from "@/modules/legal/documents";
import { LegalDocumentView } from "@/modules/legal/legal-document";
import { pageMetadata } from "@/modules/seo/metadata";

export const metadata = pageMetadata({
  title: "Privacy policy",
  description:
    "How AKS-Atelier uses your name, contact details, and order information. We do not sell your data.",
  path: "/privacy",
});

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <LegalDocumentView document={privacyDocument} />;
}
