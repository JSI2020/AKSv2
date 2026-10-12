/** Failure from a provider HTTP call. `message` is sanitized and safe to log. */
export class SocialProviderError extends Error {
  readonly provider: string;
  readonly kind: "provider" | "invalid_profile";

  constructor(
    provider: string,
    message: string,
    kind: "provider" | "invalid_profile" = "provider",
  ) {
    super(message);
    this.name = "SocialProviderError";
    this.provider = provider;
    this.kind = kind;
  }
}

/** Drop tokens and other long opaque strings before anything is logged or returned. */
export function sanitizeProviderMessage(message: string): string {
  return message.replace(/[A-Za-z0-9_\-~.]{24,}/g, "[redacted]").slice(0, 180);
}

export function graphErrorMessage(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const record = body as {
    error?: unknown;
    error_message?: unknown;
    error_description?: unknown;
  };
  const error = record.error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code.trim() && code !== "ok")
      return code.trim();
  }
  if (typeof record.error_message === "string" && record.error_message.trim()) {
    return record.error_message.trim();
  }
  if (
    typeof record.error_description === "string" &&
    record.error_description.trim()
  ) {
    return record.error_description.trim();
  }
  if (typeof error === "string" && error.trim()) return error.trim();
  return null;
}
