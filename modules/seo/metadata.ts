import type { Metadata } from "next";

import {
  absoluteUrl,
  BRAND_NAME,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  siteOrigin,
} from "./site";

const LOGO_PATH = "/brand/aks-logo.png";

export type PageMetaInput = {
  /** Segment title. The root template appends " · AKS-Atelier" unless absolute. */
  title?: string;
  description?: string;
  /** Public path, no origin, no query string. */
  path: string;
  image?: string | null;
  imageAlt?: string;
  noindex?: boolean;
  /** Use the title as the full document title (home). */
  absoluteTitle?: boolean;
};

export function pageMetadata(input: PageMetaInput): Metadata {
  const description = input.description?.trim() || DEFAULT_DESCRIPTION;
  const absolute = input.absoluteTitle === true;
  const segment = input.title?.trim();
  const fullTitle = absolute
    ? (segment || DEFAULT_TITLE)
    : segment
      ? `${segment} · ${BRAND_NAME}`
      : DEFAULT_TITLE;
  const image = absoluteUrl(input.image?.trim() || LOGO_PATH);
  const imageAlt = input.imageAlt?.trim() || BRAND_NAME;

  return {
    title: absolute ? { absolute: fullTitle } : segment,
    description,
    alternates: { canonical: input.path },
    robots: input.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      type: "website",
      url: absoluteUrl(input.path),
      siteName: BRAND_NAME,
      locale: "en_PK",
      title: fullTitle,
      description,
      images: [{ url: image, alt: imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}

export function rootMetadata(): Metadata {
  return {
    metadataBase: new URL(siteOrigin()),
    title: {
      default: DEFAULT_TITLE,
      template: `%s · ${BRAND_NAME}`,
    },
    description: DEFAULT_DESCRIPTION,
    applicationName: BRAND_NAME,
    openGraph: {
      type: "website",
      siteName: BRAND_NAME,
      locale: "en_PK",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      url: siteOrigin(),
      images: [{ url: LOGO_PATH, alt: BRAND_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      images: [LOGO_PATH],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Admin-authored product titles were stored as "Name | AKS".
 * Keep the piece name and let the title template add AKS-Atelier.
 */
export function productMetaTitle(
  seoTitle: string | null | undefined,
  name: string,
): string {
  const raw = seoTitle?.trim();
  if (!raw) return name;
  const stripped = raw
    .replace(/\s*[|·–—-]\s*AKS(?:[-\s]?Atelier)?\s*$/i, "")
    .replace(/\bAKS Atelier\b/g, BRAND_NAME)
    .trim();
  return stripped || name;
}
