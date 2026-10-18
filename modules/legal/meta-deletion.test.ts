import { createHmac } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  handleMetaDataDeletion,
  issueDeletionReceipt,
  metaAppSecrets,
  readDeletionReceipt,
  signMetaDeletionRequest,
  verifyMetaSignedRequest,
} from "./meta-deletion";

const SECRET = "facebook-app-secret";
const AUTH = "auth-secret";
const NOW = Date.parse("2026-10-11T12:00:00Z");

function formRequest(signed: string): Request {
  return new Request(
    "https://www.aks-atelier.com/api/auth/meta/data-deletion",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ signed_request: signed }),
    },
  );
}

describe("Meta signed_request", () => {
  it("accepts a request signed with the app secret", () => {
    const signed = signMetaDeletionRequest(
      { algorithm: "HMAC-SHA256", user_id: "218471", expires: NOW / 1000 + 60 },
      SECRET,
    );
    expect(verifyMetaSignedRequest(signed, [SECRET], NOW)).toEqual({
      userId: "218471",
    });
  });

  it("rejects a bad signature, a malformed body, and an expired payload", () => {
    const signed = signMetaDeletionRequest(
      { algorithm: "HMAC-SHA256", user_id: "218471" },
      SECRET,
    );
    expect(verifyMetaSignedRequest(signed, ["other-secret"], NOW)).toEqual({
      error: "bad_signature",
    });
    expect(verifyMetaSignedRequest("not-a-request", [SECRET], NOW)).toEqual({
      error: "malformed",
    });
    const expired = signMetaDeletionRequest(
      { user_id: "1", expires: NOW / 1000 - 10 },
      SECRET,
    );
    expect(verifyMetaSignedRequest(expired, [SECRET], NOW)).toEqual({
      error: "expired",
    });
  });

  it("tries each configured app secret", () => {
    const signed = signMetaDeletionRequest({ user_id: "ig-9" }, "ig-secret");
    expect(
      verifyMetaSignedRequest(signed, ["facebook-secret", "ig-secret"], NOW),
    ).toEqual({ userId: "ig-9" });
    expect(
      metaAppSecrets({
        AUTH_FACEBOOK_SECRET: " fb ",
        AUTH_INSTAGRAM_SECRET: "",
        WHATSAPP_APP_SECRET: "wa",
      }),
    ).toEqual(["fb", "wa"]);
  });

  it("does not treat a swapped signature as valid", () => {
    const signed = signMetaDeletionRequest({ user_id: "1" }, SECRET);
    const [sig, payload] = signed.split(".");
    const forged = `${createHmac("sha256", "nope").update(payload!).digest("base64url")}.${payload}`;
    expect(sig).not.toBe(forged.split(".")[0]);
    expect(verifyMetaSignedRequest(forged, [SECRET], NOW)).toEqual({
      error: "bad_signature",
    });
  });
});

describe("deletion receipt", () => {
  it("round-trips and rejects a tampered code", () => {
    const code = issueDeletionReceipt("erased", AUTH, NOW);
    expect(readDeletionReceipt(code, AUTH)).toEqual({
      v: 1,
      outcome: "erased",
      at: NOW,
    });
    expect(readDeletionReceipt(code, "other")).toBeNull();
    expect(readDeletionReceipt(`${code}x`, AUTH)).toBeNull();
  });
});

describe("POST /api/auth/meta/data-deletion", () => {
  it("returns the status URL and confirmation code after a valid request", async () => {
    const erased: string[] = [];
    const signed = signMetaDeletionRequest({ user_id: "218471" }, SECRET);
    const response = await handleMetaDataDeletion(formRequest(signed), {
      secrets: [SECRET],
      authSecret: AUTH,
      origin: "https://www.aks-atelier.com",
      nowMs: NOW,
      erase: async (providerUserId) => {
        erased.push(providerUserId);
        return "erased";
      },
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      url: string;
      confirmation_code: string;
    };
    expect(erased).toEqual(["218471"]);
    expect(body.url).toBe(
      `https://www.aks-atelier.com/data-deletion/status?code=${encodeURIComponent(body.confirmation_code)}`,
    );
    expect(readDeletionReceipt(body.confirmation_code, AUTH)?.outcome).toBe(
      "erased",
    );
  });

  it("returns 400 for a bad signature and 503 when unconfigured", async () => {
    const signed = signMetaDeletionRequest({ user_id: "1" }, SECRET);
    const bad = await handleMetaDataDeletion(formRequest(signed), {
      secrets: ["nope"],
      authSecret: AUTH,
      origin: "https://www.aks-atelier.com",
      erase: async () => "none",
    });
    expect(bad.status).toBe(400);

    const missing = await handleMetaDataDeletion(formRequest(signed), {
      secrets: [],
      authSecret: AUTH,
      origin: "https://www.aks-atelier.com",
      erase: async () => "none",
    });
    expect(missing.status).toBe(503);
  });

  it("records a staff refusal without calling it a deletion", async () => {
    const signed = signMetaDeletionRequest({ user_id: "staff-1" }, SECRET);
    const response = await handleMetaDataDeletion(formRequest(signed), {
      secrets: [SECRET],
      authSecret: AUTH,
      origin: "https://www.aks-atelier.com",
      nowMs: NOW,
      erase: async () => "kept",
    });
    const body = (await response.json()) as { confirmation_code: string };
    expect(readDeletionReceipt(body.confirmation_code, AUTH)?.outcome).toBe(
      "kept",
    );
  });
});
