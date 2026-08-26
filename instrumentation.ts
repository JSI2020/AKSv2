/**
 * Next.js instrumentation — runs once at server startup. Used to fail fast on
 * missing production configuration before the app serves any request.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateEnv } = await import("./lib/env-validate");
    validateEnv();
  }
}
