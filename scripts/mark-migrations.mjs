import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL missing");

const journal = JSON.parse(
  readFileSync("packages/db/migrations/meta/_journal.json", "utf8"),
);

const sql = postgres(url, { max: 1 });

await sql`CREATE SCHEMA IF NOT EXISTS drizzle`;
await sql`
  CREATE TABLE IF NOT EXISTS drizzle.__drizzle_migrations (
    id SERIAL PRIMARY KEY,
    hash text NOT NULL,
    created_at bigint
  )
`;
await sql`TRUNCATE drizzle.__drizzle_migrations RESTART IDENTITY`;

for (const entry of journal.entries) {
  const body = readFileSync(
    join("packages/db/migrations", `${entry.tag}.sql`),
    "utf8",
  );
  const hash = createHash("sha256").update(body).digest("hex");
  await sql`
    INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
    VALUES (${hash}, ${entry.when})
  `;
}

console.log(`marked ${journal.entries.length} migrations`);
await sql.end({ timeout: 5 });
