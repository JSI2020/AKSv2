"use client";

import { useEffect } from "react";

/** Keeps document language and direction aligned with the English-only storefront. */
export function LocaleDocumentAttributes() {
  useEffect(() => {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }, []);

  return null;
}
