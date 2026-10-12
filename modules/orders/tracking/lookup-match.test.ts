import { describe, expect, it } from "vitest";

import { orderContactMatches, phonesMatch } from "./lookup-match";

describe("order contact match", () => {
  it("treats 03 and +92 as the same mobile", () => {
    expect(phonesMatch("03378520110", "+923378520110")).toBe(true);
  });

  it("matches an order by email or phone", () => {
    const order = {
      orderEmails: ["guest@example.com"],
      orderPhones: ["+923001112233"],
    };
    expect(
      orderContactMatches({
        email: "Guest@Example.com",
        phone: null,
        ...order,
      }),
    ).toBe(true);
    expect(
      orderContactMatches({
        email: null,
        phone: "03001112233",
        ...order,
      }),
    ).toBe(true);
    expect(
      orderContactMatches({
        email: "other@example.com",
        phone: "03009990000",
        ...order,
      }),
    ).toBe(false);
  });
});
