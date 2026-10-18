import { describe, expect, it } from "vitest";

import {
  AKS_META_APP_ID,
  chooseWhatsappSendTarget,
  parseEmbeddedSignupMessage,
  summarizeWhatsappWebhook,
  whatsappEmbeddedAppId,
} from "./whatsapp-coexistence-parse";

describe("WhatsApp coexistence parsing", () => {
  it("uses the AKS Atelier app id unless WHATSAPP_APP_ID is set", () => {
    expect(whatsappEmbeddedAppId({})).toBe(AKS_META_APP_ID);
    expect(whatsappEmbeddedAppId({ WHATSAPP_APP_ID: "848524921652216" })).toBe(
      "848524921652216",
    );
  });

  it("reads a coexistence finish and ignores other postMessage payloads", () => {
    expect(
      parseEmbeddedSignupMessage({
        type: "WA_EMBEDDED_SIGNUP",
        event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
        data: {
          waba_id: "4544719972479657",
          phone_number_id: "1375619552292650",
        },
      }),
    ).toEqual({
      event: "finish",
      wabaId: "4544719972479657",
      phoneNumberId: "1375619552292650",
    });
    expect(parseEmbeddedSignupMessage({ type: "other" })).toBeNull();
    expect(
      parseEmbeddedSignupMessage({
        type: "WA_EMBEDDED_SIGNUP",
        event: "CANCEL",
        data: { current_step: "QR_CODE" },
      }),
    ).toMatchObject({ event: "cancel" });
  });

  it("prefers the linked phone number and falls back to the env token", () => {
    expect(
      chooseWhatsappSendTarget({
        envToken: "system-user",
        envPhoneNumberId: "1397628850097374",
        connectedPhoneNumberId: "1375619552292650",
        connectedToken: "business",
      }),
    ).toEqual({
      token: "business",
      phoneNumberId: "1375619552292650",
      phoneSource: "connected",
    });
    expect(
      chooseWhatsappSendTarget({
        envToken: "system-user",
        envPhoneNumberId: "1397628850097374",
        connectedPhoneNumberId: "1375619552292650",
        connectedToken: null,
      }).token,
    ).toBe("system-user");
    expect(
      chooseWhatsappSendTarget({
        envToken: "system-user",
        envPhoneNumberId: "1397628850097374",
        connectedPhoneNumberId: null,
        connectedToken: null,
      }),
    ).toMatchObject({
      phoneNumberId: "1397628850097374",
      phoneSource: "env",
    });
  });

  it("counts contacts and history without keeping message text", () => {
    const summary = summarizeWhatsappWebhook({
      entry: [
        {
          changes: [
            {
              field: "smb_app_state_sync",
              value: {
                state_sync: [
                  {
                    type: "contact",
                    action: "add",
                    contact: {
                      full_name: "Amina",
                      phone_number: "+92 337 8520110",
                    },
                  },
                ],
              },
            },
            {
              field: "history",
              value: {
                history: [
                  {
                    metadata: { progress: 40 },
                    threads: [
                      {
                        messages: [
                          { type: "text", text: { body: "secret chat" } },
                          { type: "text", text: { body: "still secret" } },
                        ],
                      },
                    ],
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(summary.contacts).toEqual([
      { waId: "923378520110", fullName: "Amina", action: "add" },
    ]);
    expect(summary.historyMessages).toBe(2);
    expect(summary.historyProgress).toBe(40);
    expect(JSON.stringify(summary)).not.toContain("secret");
  });

  it("marks history declined when Meta returns a history error", () => {
    const summary = summarizeWhatsappWebhook({
      entry: [
        {
          changes: [
            {
              field: "history",
              value: { history: [{ errors: [{ code: 2593109 }] }] },
            },
          ],
        },
      ],
    });
    expect(summary.historyDeclined).toBe(true);
    expect(summary.historyMessages).toBe(0);
  });
});
