import { describe, expect, it } from "vitest";

import { toWhatsappMsisdn } from "./phone";

describe("toWhatsappMsisdn", () => {
  it("adds the country code to a local 0-prefixed number", () => {
    expect(toWhatsappMsisdn("03001234567")).toBe("923001234567");
  });

  it("adds the country code to a bare 10-digit mobile", () => {
    expect(toWhatsappMsisdn("3001234567")).toBe("923001234567");
  });

  it("leaves an already-prefixed number alone", () => {
    expect(toWhatsappMsisdn("923001234567")).toBe("923001234567");
  });

  it("strips spaces, dashes, and a leading plus", () => {
    expect(toWhatsappMsisdn("+92 300 123 4567")).toBe("923001234567");
    expect(toWhatsappMsisdn("0300-123-4567")).toBe("923001234567");
  });

  it("returns empty for empty or nullish input", () => {
    expect(toWhatsappMsisdn("")).toBe("");
    expect(toWhatsappMsisdn(null)).toBe("");
    expect(toWhatsappMsisdn(undefined)).toBe("");
  });
});
