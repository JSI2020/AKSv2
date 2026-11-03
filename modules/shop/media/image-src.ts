import { publicSiteOrigin } from "@/modules/legal/routes";

const OWN_HOSTS = new Set([
  "www.aks-atelier.com",
  "aks-atelier.com",
  "localhost",
  "127.0.0.1",
]);

/**
 * Same-origin asset URLs become root-relative so next/image can resize them
 * and serve AVIF/WebP. External URLs are returned unchanged.
 */
export function optimizerImageSrc(src: string): string {
  if (
    !src ||
    src.startsWith("/") ||
    src.startsWith("blob:") ||
    src.startsWith("data:")
  ) {
    return src;
  }
  try {
    const url = new URL(src);
    let own = OWN_HOSTS.has(url.hostname);
    if (!own) {
      try {
        own = new URL(publicSiteOrigin()).hostname === url.hostname;
      } catch {
        own = false;
      }
    }
    if (own) return `${url.pathname}${url.search}`;
  } catch {
    return src;
  }
  return src;
}

export function imageNeedsOptimizerBypass(src: string): boolean {
  return (
    src.startsWith("blob:") ||
    src.startsWith("data:") ||
    /^https?:\/\//i.test(src)
  );
}
