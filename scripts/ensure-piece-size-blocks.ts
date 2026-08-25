import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const { sql } = await import("@aks/db");

  await sql`
    ALTER TABLE "designs"
    ADD COLUMN IF NOT EXISTS "piece_size_blocks" jsonb DEFAULT '{}'::jsonb NOT NULL
  `;

  console.log("piece_size_blocks column ensured");
  await sql.end({ timeout: 5 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
