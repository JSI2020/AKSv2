import { toWhatsappMsisdn } from "@/modules/customers/phone";

export type WhatsappLoginUser = {
  role: string;
  deletedAt: Date | null;
  status: string;
};

export type WhatsappLoginDeps = {
  enabled: () => boolean;
  clientIp: (headers: Headers) => string | null;
  rateLimit: (input: {
    email: string;
    ip: string | null;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  log: (input: {
    email: string;
    ip: string | null;
    userAgent: string | null;
    success: boolean;
    reason: string;
  }) => Promise<void>;
  findUserByPhone: (msisdn: string) => Promise<WhatsappLoginUser | null>;
  issueOtp: (phone: string) => Promise<{ devCode?: string }>;
};

const GENERIC_OK = {
  ok: true,
  message: "If we can reach that number, a code is on its way.",
};

/**
 * Storefront WhatsApp sign-in code request.
 *
 * WhatsApp has no consumer OAuth "Login with WhatsApp" product. Embedded
 * Signup connects a business's own WhatsApp Business account, which is the
 * wrong handshake for a shopper. This flow verifies the phone with a one-time
 * code sent through the WhatsApp Cloud API the house already uses for orders.
 */
export async function handleWhatsappOtpRequest(
  request: Request,
  deps: WhatsappLoginDeps,
): Promise<Response> {
  if (!deps.enabled()) {
    return Response.json(
      { error: "WhatsApp sign-in is not available." },
      { status: 404 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const phoneRaw =
    typeof body === "object" &&
    body !== null &&
    "phone" in body &&
    typeof (body as { phone: unknown }).phone === "string"
      ? (body as { phone: string }).phone
      : "";

  const msisdn = toWhatsappMsisdn(phoneRaw);
  if (msisdn.length < 11) {
    return Response.json(
      { error: "Enter a valid WhatsApp number." },
      { status: 400 },
    );
  }

  const ip = deps.clientIp(request.headers);
  const userAgent = request.headers.get("user-agent");
  const label = `wa:${msisdn}`;

  const rate = await deps.rateLimit({ email: label, ip });
  if (!rate.ok) {
    await deps.log({
      email: label,
      ip,
      userAgent,
      success: false,
      reason: `otp_rate_limited_${rate.reason}`,
    });
    return Response.json(
      { error: "Too many requests. Try again later." },
      { status: 429 },
    );
  }

  await deps.log({
    email: label,
    ip,
    userAgent,
    success: true,
    reason: "customer_whatsapp_request",
  });

  const user = await deps.findUserByPhone(msisdn);
  const isStaff = Boolean(user && !user.deletedAt && user.role !== "CUSTOMER");
  const isDisabled = Boolean(
    user && (user.deletedAt || user.status === "DISABLED"),
  );

  if (isStaff || isDisabled) {
    return Response.json(GENERIC_OK);
  }

  try {
    const issued = await deps.issueOtp(msisdn);
    return Response.json({
      ...GENERIC_OK,
      ...(issued.devCode ? { devCode: issued.devCode } : {}),
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[whatsapp] OTP send failed:", detail);
    return Response.json(
      {
        error: "Could not send a WhatsApp code right now.",
        ...(process.env.NODE_ENV !== "production" ? { detail } : {}),
      },
      { status: 502 },
    );
  }
}
