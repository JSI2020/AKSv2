import { describe, expect, it } from "vitest";

import { selectWhatsappOtpDelivery } from "./whatsapp-delivery";

describe("WhatsApp OTP delivery", () => {
  it("returns the code in the response only outside production", () => {
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "development",
        AKS_ALLOW_DEV_OTP: "1",
      }),
    ).toBe("dev_surface");
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "test",
        AKS_ALLOW_DEV_OTP: undefined,
      }),
    ).toBe("dev_surface");
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "development",
        AKS_ALLOW_DEV_OTP: "0",
      }),
    ).toBe("session_text");
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "production",
        AKS_ALLOW_DEV_OTP: "1",
        WHATSAPP_TEMPLATE_AUTH: "aks_login",
      }),
    ).toBe("auth_template");
  });

  it("uses the authentication template when one is configured", () => {
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "production",
        AKS_ALLOW_DEV_OTP: "0",
        WHATSAPP_TEMPLATE_AUTH: " aks_otp ",
      }),
    ).toBe("auth_template");
    expect(
      selectWhatsappOtpDelivery({
        NODE_ENV: "production",
        AKS_ALLOW_DEV_OTP: "0",
      }),
    ).toBe("session_text");
  });
});
