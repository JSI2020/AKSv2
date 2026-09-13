import { NextResponse } from "next/server";

import { getPublishedDesigns } from "@/modules/catalog";

export const runtime = "nodejs";

/**
 * Instant-search endpoint for the storefront typeahead. Returns a small set of
 * product hits plus the total, so the overlay can show live previews as the
 * shopper types and a "see all N" link into the full results page.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ q, total: 0, products: [] });
  }

  const { items, total } = await getPublishedDesigns({
    filters: { query: q },
    sort: "newest",
    page: 1,
    pageSize: 8,
  });

  const products = items.map((d) => ({
    id: d.id,
    slug: d.slug,
    name: d.name,
    garmentType: d.garmentTypeName,
    priceMinor: d.basePriceMinor,
    compareAtMinor: d.compareAtPriceMinor,
    thumbnailUrl: d.thumbnail?.url ?? null,
  }));

  return NextResponse.json(
    { q, total, products },
    { headers: { "cache-control": "no-store" } },
  );
}
