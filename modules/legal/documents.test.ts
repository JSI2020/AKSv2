import { describe, expect, it } from "vitest";

import {
  dataDeletionDocument,
  documentText,
  legalDocuments,
  privacyDocument,
  termsDocument,
} from "./documents";
import { LEGAL_OPERATOR_LINE, LEGAL_PLACEHOLDERS } from "./placeholders";
import {
  DATA_DELETION_STATUS_PATH,
  META_DATA_DELETION_PATH,
  PUBLIC_SITE_ORIGIN,
} from "./routes";

const BANNED = [
  "Impressum",
  "Datenschutz",
  "AGB",
  "USt-IdNr",
  "GmbH",
  "VAT",
  "luxury",
  "elevated",
  "curated",
  "timeless elegance",
];

describe("legal documents", () => {
  it("covers the four sign-in methods and Pakistan law on the privacy page", () => {
    const text = documentText(privacyDocument);
    expect(text).toContain("Facebook");
    expect(text).toContain("profile picture");
    expect(text).toContain("Instagram");
    expect(text).toContain("username");
    expect(text).toContain("TikTok");
    expect(text).toContain("open id");
    expect(text).toContain("WhatsApp");
    expect(text).toContain("10 minutes");
    expect(text).toContain("Prevention of Electronic Crimes Act, 2016");
    expect(text).toContain("Pakistani rupees (PKR)");
    expect(text).toContain("inside Pakistan");
    expect(text).toContain("order copy");
    expect(text).not.toMatch(/Urdu|Deutsch|German/);
  });

  it("states PKR prices and Pakistan-only delivery in the terms", () => {
    const text = documentText(termsDocument);
    expect(text).toContain("Pakistani rupees (PKR)");
    expect(text).toContain("only within Pakistan");
    expect(text).toContain("outside Pakistan");
    expect(text).toContain("XS–XL");
    expect(text).toContain("Prevention of Electronic Crimes Act, 2016");
    expect(text).toContain("laws of Pakistan");
    expect(text).toContain("no registered company");
  });

  it("points Meta at the deletion callback and keeps order copies", () => {
    const text = documentText(dataDeletionDocument);
    expect(text).toContain(`${PUBLIC_SITE_ORIGIN}${META_DATA_DELETION_PATH}`);
    expect(text).toContain(`${PUBLIC_SITE_ORIGIN}${DATA_DELETION_STATUS_PATH}`);
    expect(text).toContain("TikTok");
    expect(text).toContain("WhatsApp");
    expect(text).toContain("order copy");
    expect(text).toContain("staff login");
  });

  it("names the seller and invents none of the banned labels", () => {
    for (const doc of legalDocuments) {
      const text = documentText(doc);
      expect(text).toContain(LEGAL_OPERATOR_LINE);
      expect(text).toContain(LEGAL_PLACEHOLDERS.individualName);
      expect(text).toContain(LEGAL_PLACEHOLDERS.contactEmail);
      expect(text).toContain("Karachi, Pakistan");
      expect(text).not.toContain("[OWNER:");
      expect(text).not.toContain("03323595785");
      for (const banned of BANNED) {
        const pattern = new RegExp(
          `\\b${banned.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
          "i",
        );
        expect(text).not.toMatch(pattern);
      }
    }
  });
});
