import type { ContentLink } from "@aks/db";

export type ShippingMode = "FREE_PAKISTAN" | "FLAT_PAKISTAN";

export type SiteSettingsPublic = {
  leadTimePromise: string;
  leadTimeDaysMin: number;
  leadTimeDaysMax: number;
  /** Soft-launch: Pakistan only. Free by default, or flat fee in paisa. */
  shippingMode: ShippingMode;
  /** Paisa — used when shippingMode is FLAT_PAKISTAN. */
  shippingFlatMinor: number;
  /** Shown on checkout totals (e.g. free-ship promise). */
  shippingPromise: string;
  whatsappUrl: string;
  instagramUrl: string;
  facebookUrl: string;
  tiktokUrl: string;
  newsletterEnabled: boolean;
  brandName: string;
  brandNameUr: string;
  currencyCode: string;
  modelDisclosureDefault: string;
  announcementFallback: string;
};

export const DEFAULT_SITE_SETTINGS: SiteSettingsPublic = {
  leadTimePromise: "Ready to wear · timing depends on the piece",
  leadTimeDaysMin: 0,
  leadTimeDaysMax: 0,
  shippingMode: "FREE_PAKISTAN",
  shippingFlatMinor: 0,
  shippingPromise: "Free shipping within Pakistan",
  whatsappUrl: "https://wa.me/923378520110",
  instagramUrl: "https://www.instagram.com/aksatelier.official/",
  facebookUrl: "https://www.facebook.com/profile.php?id=61594255361658",
  tiktokUrl: "https://www.tiktok.com/@aksatelier.official",
  newsletterEnabled: true,
  brandName: "AKS-Atelier",
  brandNameUr: "عکس",
  currencyCode: "PKR",
  modelDisclosureDefault: "",
  announcementFallback: "",
};

export const DEFAULT_SECTIONS_ORDER = [
  "hero",
  "statement",
  "categories",
  "lookbook",
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
