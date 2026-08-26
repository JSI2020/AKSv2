import type { ContentLink } from "@aks/db";

export type SiteSettingsPublic = {
  leadTimePromise: string;
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
  whatsappUrl: string;
  instagramUrl: string;
  newsletterEnabled: boolean;
  brandName: string;
  brandNameUr: string;
  currencyCode: string;
  modelDisclosureDefault: string;
  announcementFallback: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsPublic = {
  leadTimePromise: "Ready to wear · ships in 3–5 days",
  leadTimeDaysMin: 3,
  leadTimeDaysMax: 5,
  whatsappUrl: "https://wa.me/923001234567",
  instagramUrl: "https://instagram.com/aks.atelier",
  newsletterEnabled: true,
  brandName: "AKS",
  brandNameUr: "عکس",
  currencyCode: "PKR",
  modelDisclosureDefault: "",
  announcementFallback: "",
};

export const DEFAULT_SECTIONS_ORDER = [
  "hero",
  "statement",
  "categories",
  "edit",
  "fabric",
  "atelier",
] as const;

export type HomepageSectionKey = (typeof DEFAULT_SECTIONS_ORDER)[number];

export type HeroSlidePublic = {
  id: string;
  eyebrow: string;
  headline: string;
  subtext: string;
  buttonLabel: string;
  buttonHref: string;
  textPosition: "LEFT" | "CENTRE";
  overlayStrength: number;
  desktopImageUrl: string | null;
  mobileImageUrl: string | null;
  videoUrl: string | null;
};

export type AnnouncementPublic = {
  id: string;
  message: string;
  href: string | null;
};

export type CategoryTilePublic = {
  id: string;
  categoryKey: string;
  displayName: string;
  caption: string;
  href: string;
  imageUrl: string | null;
};

export type FeaturedEditPublic = {
  mode: "auto" | "handpicked";
  designIds: string[];
};

export type FeaturedLookPublic = {
  designId: string;
  story: string;
} | null;

export type HomepagePublic = {
  sectionsOrder: string[];
  sectionsEnabled: Record<string, boolean>;
  heroes: HeroSlidePublic[];
  tiles: CategoryTilePublic[];
  statement: string | null;
  edit: FeaturedEditPublic;
  look: FeaturedLookPublic;
};

export type NavItemPublic = {
  id: string;
  label: string;
  href: string;
  columnKey: string | null;
};

export type ContentPagePublic = {
  slug: string;
  title: string;
  body: string;
};

export type ContentListItem = {
  id: string;
  icon?: string;
  text: string;
  answer?: string;
};

export type PublishedDesignOption = {
  id: string;
  name: string;
  slug: string;
  ogAssetId: string | null;
  houseDoor: string | null;
};

export function emptyLink(): ContentLink {
  return { type: "none", value: "" };
}

export function hashLink(hash: string): ContentLink {
  return { type: "hash", value: hash.startsWith("#") ? hash : `#${hash}` };
}

export function collectionLink(slug: string): ContentLink {
  return { type: "collection", value: slug };
}

export function pageLink(slug: string): ContentLink {
  return { type: "page", value: slug };
}

export function urlLink(url: string): ContentLink {
  return { type: "url", value: url };
}
