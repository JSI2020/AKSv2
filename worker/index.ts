import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

// Dynamic imports after dotenv — static imports hoist before config() runs.
async function main() {
  const { sql } = await import("@aks/db");
  const {
    drainDueMessages,
    registerHandler,
    registerTestPingHandler,
  } = await import("../modules/platform/outbox");
  const { purgeExpiredAssets } = await import("../modules/platform/assets");
  const { handleEmailSend } = await import("../modules/auth/email-handler");
  const {
    handleMessageSend,
    handleOrderTransitioned,
  } = await import("../modules/messaging");
  const { registerDesignGenerateHandler } = await import(
    "../modules/ai/generation"
  );
  const { registerTryOnHandlers } = await import("../modules/tryon");

  const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 500);

  function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  registerTestPingHandler();
  registerHandler("email.send", handleEmailSend);
  registerHandler("message.send", handleMessageSend);
  registerHandler("order.transitioned", handleOrderTransitioned);
  registerHandler("assets.purgeExpired", async () => {
    const n = await purgeExpiredAssets();
    console.log(`[worker] purged ${n} assets`);
    const { purgeExpiredSelfies } = await import("../modules/tryon/purge");
    const selfies = await purgeExpiredSelfies();
    console.log(`[worker] purged ${selfies} selfies`);
  });
  registerDesignGenerateHandler();
  registerTryOnHandlers();
  console.log(`[worker] outbox polling every ${POLL_MS}ms`);

  // Long-lived process — not serverless.
  for (;;) {
    try {
      const results = await drainDueMessages(20);
      for (const r of results) {
        if (r.kind === "sent") {
          console.log(`[worker] SENT ${r.topic} ${r.id}`);
        } else if (r.kind === "retry") {
          console.log(
            `[worker] RETRY ${r.topic} ${r.id} attempts=${r.attempts} delayMs=${r.delayMs}`,
          );
        } else if (r.kind === "dead") {
          console.log(`[worker] DEAD ${r.topic} ${r.id} attempts=${r.attempts}`);
        } else if (r.kind === "missing-handler") {
          console.log(`[worker] MISSING ${r.topic} ${r.id}`);
        }
      }
    } catch (err) {
      console.error("[worker] tick failed", err);
    }
    await sleep(POLL_MS);
  }
}

main().catch(async (err) => {
  console.error(err);
  try {
    const { sql } = await import("@aks/db");
    await sql.end({ timeout: 5 });
  } catch {
    // ignore shutdown errors
  }
  process.exit(1);
});
