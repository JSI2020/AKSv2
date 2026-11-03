import { PUBLIC_SITE_ORIGIN, publicSiteOrigin } from "@/modules/legal/routes";

/** Public brand spelling. Never shorten this to "AKS" in customer-facing copy. */
export const BRAND_NAME = "AKS-Atelier";

export const DEFAULT_TITLE = `${BRAND_NAME} — Quiet luxury, East meets West`;

export const DEFAULT_DESCRIPTION =
  "Stitched ready-to-wear Pakistani womenswear from AKS-Atelier. Quiet luxury, where East meets West — cut, cloth, and finish.";

export function siteOrigin(): string {
  return publicSiteOrigin() || PUBLIC_SITE_ORIGIN;
}

/** Absolute URL for canonical, Open Graph, sitemap, and JSON-LD. */
export function absoluteUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const origin = siteOrigin().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}

/** Collapse whitespace and cap a real description. Does not invent text. */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim();
  return `${trimmed}…`;
}

const NOINDEX_PREFIXES = ["/account", "/checkout", "/cart", "/bag", "/admin"];

export function isNoindexPath(pathname: string): boolean {
  const path = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  if (/^\/track\/[^/]+/.test(path)) return true;
  return NOINDEX_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/** Paisa → PKR decimal string without binary floats. */
export function paisaToPkr(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(Math.trunc(minor));
  const rupees = Math.trunc(abs / 100);
  const paisa = abs % 100;
  return `${negative ? "-" : ""}${rupees}.${paisa.toString().padStart(2, "0")}`;
}
