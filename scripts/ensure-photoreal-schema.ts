import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Creates photoreal tables if they do not exist.
 * Run: npx tsx scripts/ensure-photoreal-schema.ts
 *
 * Permissions (photoreal.view / generate / edit) are seeded via `npm run db:seed`
 * from ALL_PERMISSION_KEYS.
 */
async function main() {
  const { sql } = await import("@aks/db");

  await sql`
    CREATE TABLE IF NOT EXISTS photoreal_settings (
      id uuid PRIMARY KEY,
      preferred_house_model_id text NOT NULL,
      generate_model text NOT NULL,
      refine_model text NOT NULL,
      lock_seed boolean NOT NULL DEFAULT true,
      monthly_spend_reminder_usd_cents integer,
      persona_description text NOT NULL,
      persona_seed integer NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS photoreal_designs (
      id uuid PRIMARY KEY,
      title text,
      description text,
      shirt_colour text,
      trouser_colour text,
      fabric text,
      sketch_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
      old_design_url text,
      house_model_id text,
      house_model_name text,
      total_cost_usd_micros integer NOT NULL DEFAULT 0,
      created_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS photoreal_versions (
      id uuid PRIMARY KEY,
      design_id uuid NOT NULL REFERENCES photoreal_designs(id) ON DELETE CASCADE,
      parent_version_id uuid,
      image_url text NOT NULL,
      prompt text NOT NULL,
      negative_prompt text,
      seed integer,
      model_id text NOT NULL,
      feedback text,
      cost_usd_micros integer NOT NULL DEFAULT 0,
      request_id text,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  console.log("photoreal schema ensured (settings, designs, versions)");
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
