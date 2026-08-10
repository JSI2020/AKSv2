import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Idempotent columns for manual Studio create (0027). */
async function main() {
  const { sql } = await import("@aks/db");

  await sql.unsafe(`
    ALTER TABLE designs
      ADD COLUMN IF NOT EXISTS available_size_labels text[] DEFAULT '{}' NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE designs
      ADD COLUMN IF NOT EXISTS made_to_measure_offered boolean DEFAULT true NOT NULL
  `);

  console.log("Studio manual design columns ensured.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
