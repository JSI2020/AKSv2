import { config } from "dotenv";
import { spawnSync } from "node:child_process";

config({ path: ".env.local" });
config({ path: ".env" });

function run(label: string, script: string): void {
  console.log(`\n>>> ${label}\n`);
  const result = spawnSync(
    "npx",
    ["tsx", "--env-file=.env.local", script],
    { cwd: process.cwd(), encoding: "utf8", shell: true, stdio: "inherit" },
  );
  if (result.status !== 0) {
    throw new Error(`${label} failed (exit ${result.status})`);
  }
}

/** One-shot Demo fabric maintenance + catalogue seed. */
async function main() {
  run("Rename DEMO* → Demo*", "scripts/rename-demo-fabrics.ts");
  run("Delete demo-* designs", "scripts/delete-demo-designs.ts");
  run("Backfill lot ledger receives", "scripts/backfill-fabric-lot-adjustments.ts");
  run("Seed Demo fabric catalogue", "scripts/seed-demo-fabrics.ts");
  console.log("\n=== Demo fabric setup complete ===\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
