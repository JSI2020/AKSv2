import {
  SocialProviderError,
  graphErrorMessage,
  sanitizeProviderMessage,
} from "./errors";

export const PROVIDER_FETCH_TIMEOUT_MS = 12_000;

export async function readJsonBody(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

export function providerFetchInit(init?: RequestInit): RequestInit {
  if (init?.signal) return init;
  return { ...init, signal: AbortSignal.timeout(PROVIDER_FETCH_TIMEOUT_MS) };
}

export function throwIfProviderFailed(input: {
  provider: string;
  response: Response;
  body: unknown;
}): void {
  if (input.response.ok) {
    const message = graphErrorMessage(input.body);
    const error = (input.body as { error?: unknown } | null)?.error;
    const errorCode =
      error && typeof error === "object"
        ? (error as { code?: unknown }).code
        : error;
    if (
      (typeof errorCode === "string" && errorCode !== "ok") ||
      (typeof errorCode === "number" && errorCode !== 0)
    ) {
      throw new SocialProviderError(
        input.provider,
        sanitizeProviderMessage(message ?? String(errorCode)),
      );
    }
    if (typeof error === "string" && error.trim()) {
      throw new SocialProviderError(
        input.provider,
        sanitizeProviderMessage(message ?? error),
      );
    }
    return;
  }
  const message =
    graphErrorMessage(input.body) ?? `HTTP ${input.response.status}`;
  throw new SocialProviderError(
    input.provider,
    sanitizeProviderMessage(message),
  );
}
