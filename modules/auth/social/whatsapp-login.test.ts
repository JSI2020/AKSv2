import { afterEach, describe, expect, it, vi } from "vitest";

import {
  handleWhatsappOtpRequest,
  type WhatsappLoginDeps,
} from "./whatsapp-login";

function deps(overrides: Partial<WhatsappLoginDeps> = {}): WhatsappLoginDeps {
  return {
    enabled: () => true,
    clientIp: () => "127.0.0.1",
    rateLimit: async () => ({ ok: true }),
    log: async () => undefined,
    findUserByPhone: async () => null,
    issueOtp: async () => ({ devCode: "123456" }),
    ...overrides,
  };
}

function request(body: unknown, raw = false): Request {
  return new Request("http://localhost/api/auth/customer/whatsapp/request", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "vitest" },
    body: raw ? String(body) : JSON.stringify(body),
  });
}

describe("WhatsApp sign-in request", () => {
  const previous = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = previous;
  });

  it("stays hidden when the Cloud API is not configured", async () => {
    const response = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({ enabled: () => false }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: "WhatsApp sign-in is not available.",
    });
  });

  it("rejects invalid JSON and short numbers", async () => {
    const invalid = await handleWhatsappOtpRequest(request("{", true), deps());
    expect(invalid.status).toBe(400);
    const short = await handleWhatsappOtpRequest(
      request({ phone: "123" }),
      deps(),
    );
    expect(short.status).toBe(400);
    await expect(short.json()).resolves.toMatchObject({
      error: "Enter a valid WhatsApp number.",
    });
  });

  it("rate-limits repeated requests", async () => {
    const log = vi.fn(async () => undefined);
    const response = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({
        log,
        rateLimit: async () => ({ ok: false, reason: "email" }),
      }),
    );
    expect(response.status).toBe(429);
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "wa:923001234567",
        success: false,
        reason: "otp_rate_limited_email",
      }),
    );
  });

  it("does not send a code to a staff or disabled number", async () => {
    const issueOtp = vi.fn();
    const staff = await handleWhatsappOtpRequest(
      request({ phone: "+92 300 1234567" }),
      deps({
        issueOtp,
        findUserByPhone: async () => ({
          role: "ADMIN",
          deletedAt: null,
          status: "ACTIVE",
        }),
      }),
    );
    expect(staff.status).toBe(200);
    await expect(staff.json()).resolves.toEqual({
      ok: true,
      message: "If we can reach that number, a code is on its way.",
    });
    expect(issueOtp).not.toHaveBeenCalled();

    const disabled = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({
        issueOtp,
        findUserByPhone: async () => ({
          role: "CUSTOMER",
          deletedAt: new Date(),
          status: "DISABLED",
        }),
      }),
    );
    expect(disabled.status).toBe(200);
    expect(issueOtp).not.toHaveBeenCalled();
  });

  it("issues a code for a new number and returns the dev code when the sender does", async () => {
    const issueOtp = vi.fn(async () => ({ devCode: "654321" }));
    const response = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({ issueOtp }),
    );
    expect(issueOtp).toHaveBeenCalledWith("923001234567");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ devCode: "654321" });
  });

  it("hides provider details in production when the send fails", async () => {
    process.env.NODE_ENV = "production";
    const response = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({
        issueOtp: async () => {
          throw new Error("Meta said no");
        },
      }),
    );
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string; detail?: string };
    expect(body.error).toMatch(/Could not send/);
    expect(body.detail).toBeUndefined();
  });

  it("includes the provider detail outside production", async () => {
    process.env.NODE_ENV = "test";
    const response = await handleWhatsappOtpRequest(
      request({ phone: "03001234567" }),
      deps({
        issueOtp: async () => {
          throw new Error("template missing");
        },
      }),
    );
    const body = (await response.json()) as { detail?: string };
    expect(body.detail).toBe("template missing");
  });
});
