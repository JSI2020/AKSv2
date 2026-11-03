import { LEGAL_PLACEHOLDERS } from "@/modules/legal/placeholders";

import { absoluteUrl, BRAND_NAME, paisaToPkr, siteOrigin } from "./site";

export function JsonLd({
  data,
}: {
  data: Record<string, unknown> | Record<string, unknown>[];
}) {
  const json = JSON.stringify(data).replace(/</g, "\\u003c");
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

export type HomeJsonLdSettings = {
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  tiktokUrl?: string | null;
  whatsappUrl?: string | null;
};

function socialProfiles(settings: HomeJsonLdSettings): string[] {
  const urls = [
    settings.instagramUrl,
    settings.facebookUrl,
    settings.tiktokUrl,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of urls) {
    const url = raw?.trim();
    if (!url || !/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/** Organization + WebSite for the home page. Only published facts. */
export function homeJsonLd(
  settings: HomeJsonLdSettings,
): Record<string, unknown> {
  const origin = siteOrigin();
  const sameAs = socialProfiles(settings);
  const organization: Record<string, unknown> = {
    "@type": "Organization",
    name: BRAND_NAME,
    url: origin,
    logo: absoluteUrl("/brand/aks-logo.png"),
    email: LEGAL_PLACEHOLDERS.contactEmail,
    telephone: LEGAL_PLACEHOLDERS.contactPhone,
    address: {
      "@type": "PostalAddress",
      addressLocality: "Karachi",
      addressCountry: "PK",
    },
  };
  if (sameAs.length > 0) organization.sameAs = sameAs;
  if (settings.whatsappUrl?.trim()) {
    organization.contactPoint = {
      "@type": "ContactPoint",
      telephone: LEGAL_PLACEHOLDERS.contactPhone,
      contactType: "customer service",
      areaServed: "PK",
      url: settings.whatsappUrl.trim(),
    };
  }

  const website: Record<string, unknown> = {
    "@type": "WebSite",
    name: BRAND_NAME,
    url: origin,
    publisher: { "@type": "Organization", name: BRAND_NAME },
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return {
    "@context": "https://schema.org",
    "@graph": [organization, website],
  };
}

export type ProductJsonLdInput = {
  name: string;
  description?: string | null;
  slug: string;
  sku?: string | null;
  imageUrls: string[];
  priceMinor: number;
  currency?: string;
  comingSoon: boolean;
  /** Units on hand across sizes. Omit availability when this is unknown. */
  unitsOnHand?: number | null;
  breadcrumb: { name: string; path: string }[];
};

export function productJsonLd(
  input: ProductJsonLdInput,
): Record<string, unknown> {
  const url = absoluteUrl(`/designs/${input.slug}`);
  const images = [
    ...new Set(
      input.imageUrls
        .map((src) => src.trim())
        .filter(Boolean)
        .map((src) => absoluteUrl(src)),
    ),
  ];
  const product: Record<string, unknown> = {
    "@type": "Product",
    name: input.name,
    url,
    brand: { "@type": "Brand", name: BRAND_NAME },
  };
  const description = input.description?.replace(/\s+/g, " ").trim();
  if (description) product.description = description;
  if (images.length > 0) product.image = images;
  const sku = input.sku?.trim();
  if (sku) product.sku = sku;

  if (input.priceMinor > 0) {
    const offer: Record<string, unknown> = {
      "@type": "Offer",
      url,
      priceCurrency: input.currency || "PKR",
      price: paisaToPkr(input.priceMinor),
    };
    if (input.comingSoon) {
      offer.availability = "https://schema.org/PreOrder";
    } else if (input.unitsOnHand != null) {
      offer.availability =
        input.unitsOnHand > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock";
    }
    product.offers = offer;
  }

  const crumbs = [
    { name: "Home", path: "/" },
    ...input.breadcrumb.filter((c) => c.name.trim() && c.path.trim()),
    { name: input.name, path: `/designs/${input.slug}` },
  ];
  const breadcrumb: Record<string, unknown> = {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.path),
    })),
  };

  return {
    "@context": "https://schema.org",
    "@graph": [product, breadcrumb],
  };
}
