import { whatsappGraphError } from "./whatsapp";

type GraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function graphBase(version: string): string {
  return `https://graph.facebook.com/${version}`;
}

async function readBody(response: Response): Promise<GraphErrorBody & Record<string, unknown>> {
  return (await response.json().catch(() => ({}))) as GraphErrorBody &
    Record<string, unknown>;
}

/**
 * Exchange an Embedded Signup code for a business token.
 * The code and the token are never returned in the error string.
 */
export async function exchangeEmbeddedSignupCode(input: {
  appId: string;
  appSecret: string;
  code: string;
  version: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(`${graphBase(input.version)}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: input.appId,
      client_secret: input.appSecret,
      code: input.code,
    }),
  });
  const body = await readBody(response);
  const token = typeof body.access_token === "string" ? body.access_token.trim() : "";
  if (!response.ok || !token) {
    return { ok: false, error: whatsappGraphError(response.status, body) };
  }
  return { ok: true, token };
}

export async function subscribeAppToWaba(input: {
  wabaId: string;
  token: string;
  version: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${graphBase(input.version)}/${input.wabaId}/subscribed_apps`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${input.token}` },
    },
  );
  const body = await readBody(response);
  if (!response.ok) {
    return { ok: false, error: whatsappGraphError(response.status, body) };
  }
  return { ok: true };
}

export async function syncWhatsappBusinessAppData(input: {
  phoneNumberId: string;
  token: string;
  version: string;
  syncType: "smb_app_state_sync" | "history";
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const response = await fetchImpl(
    `${graphBase(input.version)}/${input.phoneNumberId}/smb_app_data`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        sync_type: input.syncType,
      }),
    },
  );
  const body = await readBody(response);
  if (!response.ok) {
    return { ok: false, error: whatsappGraphError(response.status, body) };
  }
  return { ok: true };
}

export async function fetchWhatsappPhoneProfile(input: {
  phoneNumberId: string;
  token: string;
  version: string;
  fetchImpl?: typeof fetch;
}): Promise<{ displayPhoneNumber: string | null; verifiedName: string | null }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const url = new URL(`${graphBase(input.version)}/${input.phoneNumberId}`);
  url.searchParams.set("fields", "display_phone_number,verified_name");
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${input.token}` },
  });
  const body = await readBody(response);
  if (!response.ok) return { displayPhoneNumber: null, verifiedName: null };
  const display =
    typeof body.display_phone_number === "string"
      ? body.display_phone_number.trim()
      : "";
  const name =
    typeof body.verified_name === "string" ? body.verified_name.trim() : "";
  return {
    displayPhoneNumber: display || null,
    verifiedName: name || null,
  };
}

/**
 * Ask Meta to deliver coexistence webhooks to the shop callback.
 * Failure here does not undo a successful number link; the dashboard
 * can subscribe the same fields by hand.
 */
export async function subscribeWhatsappWebhookFields(input: {
  appId: string;
  appSecret: string;
  version: string;
  callbackUrl: string;
  verifyToken: string;
  fetchImpl?: typeof fetch;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: input.callbackUrl,
    verify_token: input.verifyToken,
    fields: [
      "messages",
      "smb_app_state_sync",
      "history",
      "smb_message_echoes",
      "account_update",
    ].join(","),
    access_token: `${input.appId}|${input.appSecret}`,
  });
  const response = await fetchImpl(
    `${graphBase(input.version)}/${input.appId}/subscriptions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
  );
  const json = await readBody(response);
  if (!response.ok) {
    return { ok: false, error: whatsappGraphError(response.status, json) };
  }
  return { ok: true };
}
