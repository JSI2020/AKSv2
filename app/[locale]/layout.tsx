import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { routing } from "@/i18n/routing";
import { LocaleDocumentAttributes } from "@/modules/shop/shell/locale-document";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === "ur" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider messages={messages}>
      <LocaleDocumentAttributes locale={locale} />
      <div lang={locale} dir={dir} className="min-h-dvh">
        {children}
      </div>
    </NextIntlClientProvider>
  );
}
