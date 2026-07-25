"use client";

import { useEffect } from "react";

/** Sets document language and direction for the active locale (RTL for `ur`). */
export function LocaleDocumentAttributes({ locale }: { locale: string }) {
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = locale === "ur" ? "rtl" : "ltr";
  }, [locale]);

  return null;
}
