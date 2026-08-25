import { config } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { sql } = await import("@aks/db");
  const path = join(
    process.cwd(),
    "packages/db/migrations/0032_customer_merge.sql",
  );
  const body = readFileSync(path, "utf8");
  await sql.unsafe(body);
  console.log("customer merge schema ensured");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
