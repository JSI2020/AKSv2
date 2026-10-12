/** Public legal paths. The shop locale stays English; these URLs are unprefixed. */
export const PRIVACY_PATH = "/privacy";
export const TERMS_PATH = "/terms";
export const DATA_DELETION_PATH = "/data-deletion";
export const DATA_DELETION_STATUS_PATH = "/data-deletion/status";
export const META_DATA_DELETION_PATH = "/api/auth/meta/data-deletion";

export const PUBLIC_SITE_ORIGIN = "https://www.aks-atelier.com";

export const CANONICAL_LEGAL_PATHS = [
  PRIVACY_PATH,
  TERMS_PATH,
  DATA_DELETION_PATH,
] as const;

export type LegalRedirect = {
  source: string;
  destination: (typeof CANONICAL_LEGAL_PATHS)[number];
};

/**
 * Aliases people and developer consoles type. German paths redirect here so
 * they are not 404s; the pages themselves are the English Pakistan policy.
 */
export function legalRedirects(): LegalRedirect[] {
  return [
    { source: "/privacy-policy", destination: PRIVACY_PATH },
    { source: "/datenschutz", destination: PRIVACY_PATH },
    { source: "/datenschutzerklaerung", destination: PRIVACY_PATH },
    { source: "/terms-of-service", destination: TERMS_PATH },
    { source: "/terms-and-conditions", destination: TERMS_PATH },
    { source: "/tos", destination: TERMS_PATH },
    { source: "/agb", destination: TERMS_PATH },
    { source: "/impressum", destination: PRIVACY_PATH },
    { source: "/imprint", destination: PRIVACY_PATH },
    { source: "/legal-notice", destination: PRIVACY_PATH },
    { source: "/data-deletion-instructions", destination: DATA_DELETION_PATH },
    { source: "/user-data-deletion", destination: DATA_DELETION_PATH },
    { source: "/datenloeschung", destination: DATA_DELETION_PATH },
  ];
}

/** Storefront paths that stay reachable when the coming-soon gate is on. */
export function isPublicLegalPath(pathname: string): boolean {
  return (
    pathname === PRIVACY_PATH ||
    pathname === TERMS_PATH ||
    pathname === DATA_DELETION_PATH ||
    pathname === DATA_DELETION_STATUS_PATH ||
    pathname.startsWith(`${DATA_DELETION_PATH}/`)
  );
}

export function publicSiteOrigin(env: NodeJS.ProcessEnv = process.env): string {
  const raw = (env.NEXT_PUBLIC_SITE_URL || env.AUTH_URL || PUBLIC_SITE_ORIGIN)
    .trim()
    .replace(/\/+$/, "");
  return raw || PUBLIC_SITE_ORIGIN;
}
