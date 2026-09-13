import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/** Tables that must exist after `db:migrate` on an empty database. */
const REQUIRED_TABLES = [
  "users",
  "designs",
  "orders",
  "payments",
  "outbox",
  "rtw_stock",
  "newsletter_subscribers",
  "message_templates",
  "size_blocks",
  "size_block_rows",
  "house_collections",
] as const;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url, { max: 1 });
  const rows = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public'
      and table_type = 'BASE TABLE'`;

  const present = new Set(rows.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !present.has(t));

  await sql.end({ timeout: 5 });

  if (missing.length > 0) {
    console.error(
      `[verify-schema] Missing table(s) after migrate: ${missing.join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[verify-schema] OK — ${REQUIRED_TABLES.length} critical tables present.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
