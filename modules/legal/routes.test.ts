import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  CANONICAL_LEGAL_PATHS,
  DATA_DELETION_PATH,
  DATA_DELETION_STATUS_PATH,
  isPublicLegalPath,
  legalRedirects,
  PRIVACY_PATH,
  publicSiteOrigin,
  PUBLIC_SITE_ORIGIN,
  TERMS_PATH,
} from "./routes";

describe("legal routes", () => {
  it("sends every alias to a canonical path and does not loop", () => {
    const redirects = legalRedirects();
    const sources = redirects.map((entry) => entry.source);
    expect(new Set(sources).size).toBe(sources.length);

    for (const entry of redirects) {
      expect(CANONICAL_LEGAL_PATHS).toContain(entry.destination);
      expect(sources).not.toContain(entry.destination);
      expect(entry.source.startsWith("/")).toBe(true);
      expect(entry.source).not.toBe(entry.destination);
    }

    expect(sources).toEqual(
      expect.arrayContaining([
        "/privacy-policy",
        "/datenschutz",
        "/datenschutzerklaerung",
        "/terms-of-service",
        "/tos",
        "/agb",
        "/impressum",
        "/imprint",
        "/data-deletion-instructions",
        "/user-data-deletion",
        "/datenloeschung",
      ]),
    );
  });

  it("is wired into next.config redirects and the coming-soon gate", () => {
    const config = readFileSync("next.config.ts", "utf8");
    expect(config).toContain("legalRedirects");
    expect(config).toContain("permanent: true");

    const middleware = readFileSync("middleware.ts", "utf8");
    expect(middleware).toContain("isPublicLegalPath");

    const footer = readFileSync("modules/shop/shell/chrome.tsx", "utf8");
    expect(footer).toContain('"/privacy"');
    expect(footer).toContain('"/terms"');
    expect(footer).toContain('"/data-deletion"');
    expect(footer).not.toContain("/impressum");
  });

  it("keeps the policy pages public and leaves the shop gated", () => {
    expect(isPublicLegalPath(PRIVACY_PATH)).toBe(true);
    expect(isPublicLegalPath(TERMS_PATH)).toBe(true);
    expect(isPublicLegalPath(DATA_DELETION_PATH)).toBe(true);
    expect(isPublicLegalPath(DATA_DELETION_STATUS_PATH)).toBe(true);
    expect(isPublicLegalPath("/")).toBe(false);
    expect(isPublicLegalPath("/collections")).toBe(false);
    expect(isPublicLegalPath("/admin")).toBe(false);
  });

  it("uses the public site origin, then AUTH_URL", () => {
    expect(PUBLIC_SITE_ORIGIN).toBe("https://www.aks-atelier.com");
    expect(publicSiteOrigin({})).toBe(PUBLIC_SITE_ORIGIN);
    expect(
      publicSiteOrigin({
        NEXT_PUBLIC_SITE_URL: "https://www.aks-atelier.com/",
      }),
    ).toBe("https://www.aks-atelier.com");
    expect(publicSiteOrigin({ AUTH_URL: "http://localhost:3000/" })).toBe(
      "http://localhost:3000",
    );
  });
});
