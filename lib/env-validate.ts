/**
 * Fail-fast configuration validation, run from `instrumentation.ts` at server
 * boot. In production a missing critical variable refuses to start the process
 * (better than failing a customer mid-flow); in development it only warns.
 */
const ALWAYS_REQUIRED = ["DATABASE_URL"] as const;

// Confirmed to be used by real customer-facing flows (transactional email).
const PROD_REQUIRED = ["RESEND_API_KEY", "RESEND_FROM_EMAIL"] as const;

// Strongly recommended in production, but the app can boot without them.
const PROD_RECOMMENDED = [
  "AUTH_SECRET",
  "FAL_KEY",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "WHATSAPP_ACCESS_TOKEN",
  "WHATSAPP_PHONE_NUMBER_ID",
] as const;

function unset(key: string): boolean {
  return !process.env[key]?.trim();
}

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === "production";

  const missing = [
    ...ALWAYS_REQUIRED,
    ...(isProd ? PROD_REQUIRED : []),
  ].filter(unset);

  if (missing.length > 0) {
    const message = `[env] Missing required environment variable(s): ${missing.join(", ")}`;
    if (isProd) throw new Error(message);
    console.warn(`${message} — continuing in development.`);
  }

  if (isProd) {
    const recommended = PROD_RECOMMENDED.filter(unset);
    if (recommended.length > 0) {
      console.warn(
        `[env] Recommended production variable(s) unset: ${recommended.join(", ")}`,
      );
    }
  }
}
