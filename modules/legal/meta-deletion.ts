import { createHmac, timingSafeEqual } from "node:crypto";

import { DATA_DELETION_STATUS_PATH, publicSiteOrigin } from "./routes";

export type DeletionOutcome = "erased" | "none" | "kept";

export type MetaDeletionDeps = {
  secrets: string[];
  authSecret: string;
  origin: string;
  nowMs?: number;
  erase: (providerUserId: string) => Promise<DeletionOutcome>;
};

type SignedUser = { userId: string };

export function metaAppSecrets(env: NodeJS.ProcessEnv = process.env): string[] {
  return [
    env.AUTH_FACEBOOK_SECRET,
    env.AUTH_INSTAGRAM_SECRET,
    env.WHATSAPP_APP_SECRET,
  ]
    .map((value) => value?.trim() ?? "")
    .filter((value) => value.length > 0);
}

function decodeBase64Url(input: string): Buffer | null {
  if (!input || /[^A-Za-z0-9_-]/.test(input)) return null;
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return null;
  }
}

function signaturesMatch(actual: Buffer, expected: Buffer): boolean {
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/**
 * Meta’s data-deletion `signed_request`: base64url(HMAC-SHA256(payload)).base64url(json).
 * The HMAC is over the encoded payload, using an app secret.
 */
export function verifyMetaSignedRequest(
  signedRequest: string,
  secrets: string[],
  nowMs = Date.now(),
): SignedUser | { error: "malformed" | "bad_signature" | "expired" } {
  const parts = signedRequest.split(".");
  if (parts.length !== 2) return { error: "malformed" };
  const [encodedSig, encodedPayload] = parts;
  if (!encodedSig || !encodedPayload) return { error: "malformed" };

  const signature = decodeBase64Url(encodedSig);
  const payloadBuf = decodeBase64Url(encodedPayload);
  if (!signature || !payloadBuf) return { error: "malformed" };

  let payload: unknown;
  try {
    payload = JSON.parse(payloadBuf.toString("utf8"));
  } catch {
    return { error: "malformed" };
  }
  if (!payload || typeof payload !== "object") return { error: "malformed" };

  const record = payload as {
    algorithm?: unknown;
    user_id?: unknown;
    expires?: unknown;
  };
  if (record.algorithm !== undefined && record.algorithm !== "HMAC-SHA256") {
    return { error: "malformed" };
  }
  const userId =
    typeof record.user_id === "string" ? record.user_id.trim() : "";
  if (!userId) return { error: "malformed" };
  if (typeof record.expires === "number" && record.expires * 1000 < nowMs) {
    return { error: "expired" };
  }

  const matched = secrets.some((secret) => {
    const expected = createHmac("sha256", secret)
      .update(encodedPayload)
      .digest();
    return signaturesMatch(signature, expected);
  });
  if (!matched) return { error: "bad_signature" };
  return { userId };
}

/** Build a signed_request the same way Meta does. Tests and local checks use this. */
export function signMetaDeletionRequest(
  payload: Record<string, unknown>,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  const encodedSig = createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedSig}.${encodedPayload}`;
}

type Receipt = { v: 1; outcome: DeletionOutcome; at: number };

export function issueDeletionReceipt(
  outcome: DeletionOutcome,
  authSecret: string,
  at = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ v: 1, outcome, at } satisfies Receipt),
    "utf8",
  ).toString("base64url");
  const sig = createHmac("sha256", authSecret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export function readDeletionReceipt(
  code: string,
  authSecret: string,
): Receipt | null {
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", authSecret)
    .update(payload)
    .digest("base64url");
  const actualBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (!signaturesMatch(actualBuf, expectedBuf)) return null;
  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as Partial<Receipt>;
    if (parsed.v !== 1) return null;
    if (
      parsed.outcome !== "erased" &&
      parsed.outcome !== "none" &&
      parsed.outcome !== "kept"
    ) {
      return null;
    }
    if (typeof parsed.at !== "number") return null;
    return { v: 1, outcome: parsed.outcome, at: parsed.at };
  } catch {
    return null;
  }
}

export function deletionStatusUrl(origin: string, code: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${DATA_DELETION_STATUS_PATH}?code=${encodeURIComponent(code)}`;
}

async function readSignedRequestField(
  request: Request,
): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      signed_request?: unknown;
    } | null;
    return typeof body?.signed_request === "string"
      ? body.signed_request
      : null;
  }
  const text = await request.text();
  const value = new URLSearchParams(text).get("signed_request");
  return value;
}

export async function handleMetaDataDeletion(
  request: Request,
  deps: MetaDeletionDeps,
): Promise<Response> {
  if (deps.secrets.length === 0 || !deps.authSecret.trim()) {
    return Response.json(
      { error: "Data deletion is not configured." },
      { status: 503 },
    );
  }

  const signed = await readSignedRequestField(request);
  if (!signed) {
    return Response.json({ error: "Missing signed_request." }, { status: 400 });
  }

  const verified = verifyMetaSignedRequest(
    signed,
    deps.secrets,
    deps.nowMs ?? Date.now(),
  );
  if ("error" in verified) {
    return Response.json({ error: "Invalid signed_request." }, { status: 400 });
  }

  const outcome = await deps.erase(verified.userId);
  const code = issueDeletionReceipt(
    outcome,
    deps.authSecret,
    deps.nowMs ?? Date.now(),
  );
  return Response.json({
    url: deletionStatusUrl(deps.origin, code),
    confirmation_code: code,
  });
}

export function liveMetaDeletionConfig(
  env: NodeJS.ProcessEnv = process.env,
): Omit<MetaDeletionDeps, "erase"> {
  return {
    secrets: metaAppSecrets(env),
    authSecret: env.AUTH_SECRET?.trim() ?? "",
    origin: publicSiteOrigin(env),
  };
}
