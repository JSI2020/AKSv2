import type { ContentLink } from "@aks/db";

/** Dedicated shop routes that must not resolve under `/pages/…`. */
const SHOP_ROUTE_SLUGS: Record<string, string> = {
  fabrics: "/fabrics",
  "size-guide": "/size-guide",
  collections: "/collections",
  checkout: "/checkout",
  account: "/account/orders",
  cart: "/checkout",
};

/** Resolve a content link picker value to a storefront path or absolute URL. */
export function resolveContentLink(link: ContentLink | null | undefined): string {
  if (!link || link.type === "none" || !link.value) return "#";
  switch (link.type) {
    case "collection":
      return `/collections/${link.value}`;
    case "design":
      return `/designs/${link.value}`;
    case "page": {
      const slug = link.value.replace(/^\//, "").replace(/^pages\//, "");
      return SHOP_ROUTE_SLUGS[slug] ?? `/pages/${slug}`;
    }
    case "hash":
      return link.value.startsWith("#") ? link.value : `#${link.value}`;
    case "url":
      return link.value;
    default:
      return "#";
  }
}
