import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Idempotent columns for Studio editor revamp (0028). */
async function main() {
  const { sql } = await import("@aks/db");

  await sql.unsafe(`
    ALTER TABLE designs ADD COLUMN IF NOT EXISTS item_number text
  `);
  await sql.unsafe(`
    ALTER TABLE designs
      ADD COLUMN IF NOT EXISTS studio_angle_picks text[] DEFAULT '{}' NOT NULL
  `);
  await sql.unsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS designs_item_number_uidx
      ON designs (item_number)
      WHERE item_number IS NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE colourways
      ADD COLUMN IF NOT EXISTS piece_fabrics jsonb DEFAULT '{}'::jsonb NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE design_costs
      ADD COLUMN IF NOT EXISTS shipping_minor integer DEFAULT 0 NOT NULL
  `);

  console.log("Studio editor revamp columns ensured.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
