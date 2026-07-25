import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { sql } from "@aks/db";
import {
  drainDueMessages,
  registerTestPingHandler,
} from "../modules/platform/outbox";

const POLL_MS = Number(process.env.OUTBOX_POLL_MS ?? 500);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  registerTestPingHandler();
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
