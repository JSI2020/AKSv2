import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "@aks/db";
import {
  drainDueMessages,
  registerHandler,
  registerTestPingHandler,
} from "../modules/platform/outbox";
import { purgeExpiredAssets } from "../modules/platform/assets";
import { handleEmailSend } from "../modules/auth/email-handler";
import {
  handleMessageSend,
  handleOrderTransitioned,
} from "../modules/messaging";
import { registerDesignGenerateHandler } from "../modules/ai/generation";
import { registerTryOnHandlers } from "../modules/tryon";

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 500);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
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
  await sql.end({ timeout: 5 });
  process.exit(1);
});
