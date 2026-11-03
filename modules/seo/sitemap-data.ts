import { and, eq, sql } from "drizzle-orm";
import type { MetadataRoute } from "next";

import {
  contentPages,
  db,
  designs,
  garmentCategories,
  houseCollections,
} from "@aks/db";
import { DEFAULT_HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { absoluteUrl } from "./site";

const RESERVED_PAGE_SLUGS = new Set([
  "collections",
  "designs",
  "fabrics",
  "cart",
  "checkout",
  "account",
  "size-guide",
  "measure",
  "privacy",
  "terms",
  "search",
  "wishlist",
  "bag",
  "track",
]);

const STATIC_PATHS = [
  "/",
  "/collections",
  "/collections/all",
  "/collections/new",
  "/collections/best-sellers",
  "/collections/coming-soon",
  "/collections/fusion",
  "/fabrics",
  "/size-guide",
  "/privacy",
  "/terms",
  "/data-deletion",
  "/search",
  "/track",
] as const;

function entry(
  path: string,
  priority: number,
  lastModified?: Date | null,
): MetadataRoute.Sitemap[number] {
  const changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] =
    path === "/" ? "daily" : "weekly";
  return {
    url: absoluteUrl(path),
    lastModified: lastModified ?? undefined,
    changeFrequency,
    priority,
  };
}

/**
 * Indexable URLs: home, real collections, published pieces, and static pages.
 * Account, cart, and checkout are omitted (they are noindex and disallowed).
 */
export async function buildSitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = STATIC_PATHS.map((path) =>
    entry(path, path === "/" ? 1 : 0.6),
  );
  const seen = new Set<string>(pages.map((p) => p.url));

  function add(path: string, priority: number, lastModified?: Date | null) {
    const url = absoluteUrl(path);
    if (seen.has(url)) return;
    seen.add(url);
    pages.push(entry(path, priority, lastModified));
  }

  try {
    const houses = await db
      .select({
        slug: houseCollections.slug,
        active: houseCollections.active,
      })
      .from(houseCollections);
    const houseSlugs =
      houses.length > 0
        ? houses.filter((h) => h.active).map((h) => h.slug)
        : DEFAULT_HOUSE_COLLECTIONS.map((h) => h.slug);
    for (const slug of houseSlugs) {
      add(`/collections/${slug}`, 0.8);
    }
  } catch {
    for (const house of DEFAULT_HOUSE_COLLECTIONS) {
      add(`/collections/${house.slug}`, 0.8);
    }
  }

  try {
    const categories = await db
      .select({ key: garmentCategories.key })
      .from(garmentCategories);
    for (const category of categories) {
      const slug = category.key.trim().toLowerCase().replace(/_/g, "-");
      if (slug) add(`/collections/${slug}`, 0.5);
    }
  } catch {
    // Category URLs are omitted when the database is unreachable.
  }

  try {
    const products = await db
      .select({
        slug: designs.slug,
        updatedAt: designs.updatedAt,
      })
      .from(designs)
      .where(
        and(
          eq(designs.status, "PUBLISHED"),
          sql`NOT (${designs.name} ~* '^test[[:space:]]*[0-9]')`,
          sql`NOT (${designs.name} ~* '[[:<:]]test[[:>:]]')`,
        ),
      );
    for (const product of products) {
      add(`/designs/${product.slug}`, 0.7, product.updatedAt);
    }
  } catch {
    // Product URLs are omitted when the database is unreachable.
  }

  try {
    const published = await db
      .select({
        slug: contentPages.slug,
        updatedAt: contentPages.updatedAt,
      })
      .from(contentPages)
      .where(eq(contentPages.status, "PUBLISHED"));
    for (const page of published) {
      if (RESERVED_PAGE_SLUGS.has(page.slug)) continue;
      add(`/pages/${page.slug}`, 0.4, page.updatedAt);
    }
  } catch {
    // Content pages are omitted when the database is unreachable.
  }

  return pages;
}
