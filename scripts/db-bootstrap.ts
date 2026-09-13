import { execSync } from "node:child_process";

/**
 * Single entry point for fresh environments: apply Drizzle migrations, then
 * verify critical tables exist. Replaces the ad-hoc `db:ensure:*` script chain
 * for CI and new production databases.
 */
function run(cmd: string) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

run("npx drizzle-kit migrate --config drizzle.config.ts");
run("npx tsx scripts/verify-schema.ts");
if (process.env.CI || process.env.SEED_BOOTSTRAP === "1") {
  run("npx tsx scripts/seed-bootstrap-data.ts");
}
