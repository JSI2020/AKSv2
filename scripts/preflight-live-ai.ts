import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Preflight before live fal + R2 generation (Design Photos, Studio). */
async function main() {
  const checks: { name: string; ok: boolean; detail: string }[] = [];

  const mock = process.env.AI_GENERATION_MOCK === "1";
  checks.push({
    name: "AI_GENERATION_MOCK",
    ok: !mock,
    detail: mock
      ? "Set AI_GENERATION_MOCK=0 in .env.local for live fal"
      : "Live fal enabled",
  });

  const falKey = process.env.FAL_KEY?.trim();
  checks.push({
    name: "FAL_KEY",
    ok: Boolean(falKey),
    detail: falKey ? "Present" : "Missing — add from https://fal.ai/dashboard/keys",
  });

  const r2Vars = [
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_ENDPOINT",
  ] as const;
  const r2Missing = r2Vars.filter((k) => !process.env[k]?.trim());
  checks.push({
    name: "R2 env",
    ok: r2Missing.length === 0,
    detail:
      r2Missing.length === 0
        ? `Endpoint ${process.env.R2_ENDPOINT}`
        : `Missing: ${r2Missing.join(", ")}`,
  });

  if (r2Missing.length === 0) {
    try {
      const { createR2Client, ensureBucket, getBucket } = await import(
        "@/modules/platform/assets"
      );
      const { HeadBucketCommand } = await import("@aws-sdk/client-s3");
      const client = createR2Client();
      await client.send(new HeadBucketCommand({ Bucket: getBucket() }));
      checks.push({
        name: "R2 reachable",
        ok: true,
        detail: `Bucket ${getBucket()} OK`,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      checks.push({
        name: "R2 reachable",
        ok: false,
        detail: `${msg}. Start MinIO: docker compose up -d minio minio-init (host port 9010) or minio server on :9000`,
      });
    }
  }

  try {
    const { execSync } = await import("node:child_process");
    execSync("npx tsx scripts/ensure-studio-ai-models.ts", {
      stdio: "pipe",
      env: process.env,
    });
    checks.push({
      name: "studio_settings AI models",
      ok: true,
      detail: "Verified fal models configured",
    });
  } catch (e) {
    checks.push({
      name: "studio_settings AI models",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    });
  }

  console.log("\nLive AI preflight\n");
  for (const c of checks) {
    console.log(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`);
  }

  const failed = checks.filter((c) => !c.ok);
  if (failed.length > 0) {
    console.log(
      `\n${failed.length} check(s) failed. Fix above, then run:\n  npm run prove:manual-studio\n`,
    );
    process.exit(1);
  }

  console.log(
    "\nAll checks passed. Run:\n  npm run prove:manual-studio   # one live COLOURWAY angle\n  npm run dev                 # admin UI\n",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
