import { describe, expect, it } from "vitest";

import { authChannelAction } from "./channel";

describe("authChannelAction", () => {
  it("ignores channels that are not configured", () => {
    expect(authChannelAction({ key: "instagram", status: "soon" })).toEqual({
      type: "ignore",
    });
    expect(authChannelAction({ key: "tiktok", status: "soon" })).toEqual({
      type: "ignore",
    });
  });

  it("sends WhatsApp to the phone form and the others to OAuth", () => {
    expect(authChannelAction({ key: "whatsapp", status: "live" })).toEqual({
      type: "route",
      href: "/account/login/whatsapp",
    });
    for (const provider of [
      "facebook",
      "instagram",
      "tiktok",
      "google",
    ] as const) {
      expect(authChannelAction({ key: provider, status: "live" })).toEqual({
        type: "oauth",
        provider,
      });
    }
  });
});
