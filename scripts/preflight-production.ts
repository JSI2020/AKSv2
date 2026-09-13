import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

type Check = { name: string; ok: boolean; detail: string };

function envSet(key: string): boolean {
  return Boolean(process.env[key]?.trim());
}

async function main() {
  const strict = process.argv.includes("--strict");
  const isProd = process.env.NODE_ENV === "production" || strict;
  const checks: Check[] = [];

  checks.push({
    name: "DATABASE_URL",
    ok: envSet("DATABASE_URL"),
    detail: envSet("DATABASE_URL") ? "set" : "missing",
  });

  checks.push({
    name: "AUTH_SECRET",
    ok: !isProd || envSet("AUTH_SECRET"),
    detail: envSet("AUTH_SECRET") ? "set" : isProd ? "missing (required in prod)" : "optional in dev",
  });

  checks.push({
    name: "RESEND_FROM_EMAIL",
    ok: !isProd || envSet("RESEND_FROM_EMAIL"),
    detail: envSet("RESEND_FROM_EMAIL") ? process.env.RESEND_FROM_EMAIL! : "missing",
  });

  checks.push({
    name: "RESEND_API_KEY",
    ok: !isProd || envSet("RESEND_API_KEY"),
    detail: envSet("RESEND_API_KEY") ? "set" : "missing",
  });

  const safepayKeys = [
    "SAFEPAY_AGGREGATOR_ID",
    "SAFEPAY_SECRET_KEY",
    "SAFEPAY_AGGREGATOR_MERCHANT_IDENTIFIER",
    "SAFEPAY_WEBHOOK_SECRET",
  ] as const;
  const safepayReady = safepayKeys.every(envSet);
  checks.push({
    name: "Safepay (wallet gateway)",
    ok: !strict || safepayReady,
    detail: safepayReady
      ? "all keys set"
      : `missing: ${safepayKeys.filter((k) => !envSet(k)).join(", ")}`,
  });

  const waReady =
    envSet("WHATSAPP_ACCESS_TOKEN") && envSet("WHATSAPP_PHONE_NUMBER_ID");
  checks.push({
    name: "WhatsApp Cloud API",
    ok: !strict || waReady,
    detail: waReady ? "configured" : "WHATSAPP_ACCESS_TOKEN / PHONE_NUMBER_ID unset",
  });

  if (process.env.WHATSAPP_USE_TEMPLATES === "1") {
    const { WHATSAPP_META_TEMPLATE_ENV } = await import(
      "../modules/messaging/providers/whatsapp-templates"
    );
    const mapped = Object.entries(WHATSAPP_META_TEMPLATE_ENV).filter(([, envKey]) =>
      envSet(envKey),
    );
    checks.push({
      name: "WhatsApp Meta templates",
      ok: mapped.length > 0,
      detail: `${mapped.length}/${Object.keys(WHATSAPP_META_TEMPLATE_ENV).length} template env names set`,
    });
  }

  checks.push({
    name: "ALERT_WEBHOOK_URL",
    ok: !strict || envSet("ALERT_WEBHOOK_URL"),
    detail: envSet("ALERT_WEBHOOK_URL") ? "set (DEAD outbox alerts)" : "optional — recommended for prod",
  });

  checks.push({
    name: "R2 storage",
    ok: !strict || (envSet("R2_BUCKET") && envSet("R2_ACCESS_KEY_ID")),
    detail:
      envSet("R2_BUCKET") && envSet("R2_ACCESS_KEY_ID")
        ? "configured"
        : "missing asset storage keys",
  });

  checks.push({
    name: "FAL_KEY (sizing AI)",
    ok: !strict || envSet("FAL_KEY") || process.env.AI_GENERATION_MOCK === "1",
    detail: envSet("FAL_KEY")
      ? "set"
      : process.env.AI_GENERATION_MOCK === "1"
        ? "mock mode"
        : "missing",
  });

  if (envSet("DATABASE_URL")) {
    try {
      const { db, sql } = await import("@aks/db");
      const { sql: dsql } = await import("drizzle-orm");
      await db.execute(dsql`select 1`);
      checks.push({ name: "Database reachable", ok: true, detail: "connected" });
      await sql.end({ timeout: 5 });
    } catch (e) {
      checks.push({
        name: "Database reachable",
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  console.log("\n=== Production preflight ===\n");
  let failed = 0;
  for (const c of checks) {
    const mark = c.ok ? "OK" : "FAIL";
    if (!c.ok) failed += 1;
    console.log(`${mark.padEnd(5)} ${c.name} — ${c.detail}`);
  }

  console.log(`\n${checks.length - failed}/${checks.length} passed.`);

  if (failed > 0 && (strict || isProd)) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
