import { describe, expect, it } from "vitest";

import { canonicalHttpsRedirectTarget } from "./https-redirect";
import { homeJsonLd, productJsonLd } from "./json-ld";
import { productMetaTitle } from "./metadata";
import { isNoindexPath, metaDescription, paisaToPkr } from "./site";

describe("paisaToPkr", () => {
  it("formats minor units without floating point", () => {
    expect(paisaToPkr(185000)).toBe("1850.00");
    expect(paisaToPkr(185050)).toBe("1850.50");
    expect(paisaToPkr(99)).toBe("0.99");
    expect(paisaToPkr(0)).toBe("0.00");
  });
});

describe("index paths", () => {
  it("noindexes account, cart, bag, checkout, and admin", () => {
    expect(isNoindexPath("/account")).toBe(true);
    expect(isNoindexPath("/account/orders")).toBe(true);
    expect(isNoindexPath("/checkout/pay")).toBe(true);
    expect(isNoindexPath("/cart")).toBe(true);
    expect(isNoindexPath("/bag")).toBe(true);
    expect(isNoindexPath("/admin/designs")).toBe(true);
    expect(isNoindexPath("/track/AKS-1001")).toBe(true);
    expect(isNoindexPath("/track")).toBe(false);
    expect(isNoindexPath("/collections/essentials")).toBe(false);
    expect(isNoindexPath("/")).toBe(false);
  });
});

describe("product titles", () => {
  it("drops a stored AKS suffix and keeps the piece name", () => {
    expect(productMetaTitle("Noor kurta | AKS", "Noor kurta")).toBe(
      "Noor kurta",
    );
    expect(productMetaTitle("Noor kurta | AKS-Atelier", "Noor kurta")).toBe(
      "Noor kurta",
    );
    expect(productMetaTitle(null, "Noor kurta")).toBe("Noor kurta");
  });
});

describe("meta descriptions", () => {
  it("does not invent text when the source is short", () => {
    expect(metaDescription("Cut from khaddi.")).toBe("Cut from khaddi.");
  });
});

describe("https redirect", () => {
  it("301s production http on the public hosts to https www", () => {
    expect(
      canonicalHttpsRedirectTarget({
        nodeEnv: "production",
        forwardedProto: "http",
        forwardedHost: "aks-atelier.com",
        host: "app:3000",
        pathname: "/collections/essentials",
        search: "?page=2",
      }),
    ).toBe("https://www.aks-atelier.com/collections/essentials?page=2");
  });

  it("leaves https, localhost, and development alone", () => {
    expect(
      canonicalHttpsRedirectTarget({
        nodeEnv: "production",
        forwardedProto: "https",
        forwardedHost: "www.aks-atelier.com",
        host: "www.aks-atelier.com",
        pathname: "/",
        search: "",
      }),
    ).toBeNull();
    expect(
      canonicalHttpsRedirectTarget({
        nodeEnv: "development",
        forwardedProto: "http",
        forwardedHost: "localhost:3000",
        host: "localhost:3000",
        pathname: "/",
        search: "",
      }),
    ).toBeNull();
    expect(
      canonicalHttpsRedirectTarget({
        nodeEnv: "production",
        forwardedProto: null,
        forwardedHost: null,
        host: "127.0.0.1:3000",
        pathname: "/",
        search: "",
      }),
    ).toBeNull();
  });
});

describe("json-ld", () => {
  it("builds organization and website from real settings only", () => {
    const data = homeJsonLd({
      instagramUrl: "https://www.instagram.com/aksatelier.official/",
      facebookUrl: "",
      tiktokUrl: null,
      whatsappUrl: "https://wa.me/923378520110",
    });
    const graph = data["@graph"] as Record<string, unknown>[];
    const org = graph[0]!;
    expect(org.name).toBe("AKS-Atelier");
    expect(org.sameAs).toEqual([
      "https://www.instagram.com/aksatelier.official/",
    ]);
    expect(JSON.stringify(data)).not.toMatch(/price|discount|aggregateRating/i);
  });

  it("omits an offer when the price is zero and never adds a rating", () => {
    const data = productJsonLd({
      name: "Noor",
      description: "Panelled kurta in khaddi.",
      slug: "noor",
      sku: null,
      imageUrls: [],
      priceMinor: 0,
      comingSoon: false,
      unitsOnHand: 0,
      breadcrumb: [{ name: "Essentials", path: "/collections/essentials" }],
    });
    const graph = data["@graph"] as Record<string, unknown>[];
    const product = graph[0]!;
    expect(product.offers).toBeUndefined();
    expect(product.aggregateRating).toBeUndefined();
    expect(product.description).toBe("Panelled kurta in khaddi.");
  });

  it("publishes the real paisa price and stock state", () => {
    const data = productJsonLd({
      name: "Noor",
      description: null,
      slug: "noor",
      sku: "AKS-es-0001",
      imageUrls: ["/api/assets/serve?key=a.jpg"],
      priceMinor: 185000,
      comingSoon: false,
      unitsOnHand: 3,
      breadcrumb: [{ name: "Essentials", path: "/collections/essentials" }],
    });
    const graph = data["@graph"] as Record<string, unknown>[];
    const product = graph[0]!;
    const offer = product.offers as Record<string, unknown>;
    expect(offer.price).toBe("1850.00");
    expect(offer.priceCurrency).toBe("PKR");
    expect(offer.availability).toBe("https://schema.org/InStock");
    expect(product.sku).toBe("AKS-es-0001");
    expect(product.description).toBeUndefined();
  });
});
