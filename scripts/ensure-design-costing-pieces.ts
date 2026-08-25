import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/** Idempotent columns for design costing pieces (0029). */
async function main() {
  const { sql } = await import("@aks/db");

  await sql.unsafe(`
    ALTER TABLE design_costs
      ADD COLUMN IF NOT EXISTS overhead_minor integer DEFAULT 0 NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE design_costs
      ADD COLUMN IF NOT EXISTS costing_mode text DEFAULT 'DETAILED_PER_PIECE' NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE design_costs
      ADD COLUMN IF NOT EXISTS piece_costs jsonb DEFAULT '[]'::jsonb NOT NULL
  `);
  await sql.unsafe(`
    ALTER TABLE design_costs
      ADD COLUMN IF NOT EXISTS total_lumpsum_minor integer
  `);

  console.log("design_costs piece columns ensured");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
