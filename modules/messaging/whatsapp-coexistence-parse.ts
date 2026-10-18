/** Meta app "AKS Atelier". Public id, not a secret. */
export const AKS_META_APP_ID = "848524921652216";

/** House WhatsApp Business app number and its Cloud API ids. */
export const HOUSE_WHATSAPP_DISPLAY = "+923378520110";
export const HOUSE_WHATSAPP_WABA_ID = "4544719972479657";
export const HOUSE_WHATSAPP_PHONE_NUMBER_ID = "1375619552292650";

export const WHATSAPP_COEXISTENCE_FEATURE = "whatsapp_business_app_onboarding";

const META_ID = /^\d{6,22}$/;

export function whatsappGraphVersion(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  return /^v\d+\.\d+$/.test(raw) ? raw : "v21.0";
}

export function whatsappEmbeddedAppId(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.WHATSAPP_APP_ID?.trim();
  return raw && META_ID.test(raw) ? raw : AKS_META_APP_ID;
}

export function whatsappEmbeddedAppSecret(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const secret = env.WHATSAPP_APP_SECRET?.trim();
  return secret || null;
}

export function isMetaId(value: string | null | undefined): value is string {
  return Boolean(value && META_ID.test(value.trim()));
}

export type EmbeddedSignupFinish = {
  event: "finish";
  wabaId: string;
  phoneNumberId: string;
};

export type EmbeddedSignupNotice = {
  event: "cancel" | "error";
  detail: string;
};

/**
 * Session info posted by the Facebook JS SDK (`WA_EMBEDDED_SIGNUP`).
 * Finish events carry the WABA and phone number id. Cancel and error do not.
 */
export function parseEmbeddedSignupMessage(
  raw: unknown,
): EmbeddedSignupFinish | EmbeddedSignupNotice | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as { type?: unknown; event?: unknown; data?: unknown };
  if (record.type !== "WA_EMBEDDED_SIGNUP") return null;
  const event = typeof record.event === "string" ? record.event : "";
  const data =
    record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : {};
  if (
    event === "FINISH" ||
    event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
  ) {
    const wabaId = typeof data.waba_id === "string" ? data.waba_id.trim() : "";
    const phoneNumberId =
      typeof data.phone_number_id === "string" ? data.phone_number_id.trim() : "";
    if (!isMetaId(wabaId) || !isMetaId(phoneNumberId)) return null;
    return { event: "finish", wabaId, phoneNumberId };
  }
  if (event === "CANCEL") {
    const step = typeof data.current_step === "string" ? data.current_step : "";
    return {
      event: "cancel",
      detail: step ? `Stopped at ${step.slice(0, 80)}` : "Signup was cancelled",
    };
  }
  if (event === "ERROR") {
    const message =
      typeof data.error_message === "string" ? data.error_message.trim() : "";
    return {
      event: "error",
      detail: (message || "WhatsApp signup failed").slice(0, 180),
    };
  }
  return null;
}

export type SyncedContact = {
  waId: string;
  fullName: string | null;
  action: "add" | "remove";
};

export type WhatsappSyncSummary = {
  contacts: SyncedContact[];
  historyMessages: number;
  historyProgress: number | null;
  historyDeclined: boolean;
};

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * Pull contact rows and history progress out of a Cloud API webhook.
 * Message text is not kept.
 */
export function summarizeWhatsappWebhook(body: unknown): WhatsappSyncSummary {
  const summary: WhatsappSyncSummary = {
    contacts: [],
    historyMessages: 0,
    historyProgress: null,
    historyDeclined: false,
  };
  const root = asRecord(body);
  const entries = Array.isArray(root?.entry) ? root.entry : [];
  for (const entry of entries) {
    const changes = Array.isArray(asRecord(entry)?.changes)
      ? (asRecord(entry)?.changes as unknown[])
      : [];
    for (const change of changes) {
      const record = asRecord(change);
      const field = typeof record?.field === "string" ? record.field : "";
      const value = asRecord(record?.value);
      if (!value) continue;
      if (field === "smb_app_state_sync") {
        const rows = Array.isArray(value.state_sync) ? value.state_sync : [];
        for (const row of rows) {
          const item = asRecord(row);
          const contact = asRecord(item?.contact);
          const phone =
            typeof contact?.phone_number === "string"
              ? digits(contact.phone_number)
              : "";
          if (phone.length < 8) continue;
          const name =
            typeof contact?.full_name === "string" && contact.full_name.trim()
              ? contact.full_name.trim().slice(0, 120)
              : null;
          const action = item?.action === "remove" ? "remove" : "add";
          summary.contacts.push({ waId: phone, fullName: name, action });
        }
      }
      if (field === "history") {
        const chunks = Array.isArray(value.history) ? value.history : [];
        for (const chunk of chunks) {
          const item = asRecord(chunk);
          const errors = Array.isArray(item?.errors) ? item.errors : [];
          if (errors.length > 0) summary.historyDeclined = true;
          const meta = asRecord(item?.metadata);
          const progress = meta?.progress;
          if (typeof progress === "number" && Number.isFinite(progress)) {
            summary.historyProgress = Math.max(
              summary.historyProgress ?? 0,
              progress,
            );
          }
          const threads = Array.isArray(item?.threads) ? item.threads : [];
          for (const thread of threads) {
            const messages = asRecord(thread)?.messages;
            if (Array.isArray(messages)) summary.historyMessages += messages.length;
          }
        }
      }
    }
  }
  return summary;
}

/** Connected phone number wins. The system-user token in env is the fallback. */
export function chooseWhatsappSendTarget(input: {
  envToken: string | null;
  envPhoneNumberId: string | null;
  connectedPhoneNumberId: string | null;
  connectedToken: string | null;
}): {
  token: string | null;
  phoneNumberId: string | null;
  phoneSource: "connected" | "env";
} {
  const phoneNumberId = input.connectedPhoneNumberId || input.envPhoneNumberId;
  const token = input.connectedToken || input.envToken;
  return {
    token,
    phoneNumberId,
    phoneSource: input.connectedPhoneNumberId ? "connected" : "env",
  };
}
