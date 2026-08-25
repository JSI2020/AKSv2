import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  // Connection 1: hero column + ADD VALUE (must commit before using CATEGORY)
  const sql1 = postgres(url, { max: 1 });
  await sql1.unsafe(`
ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "linked_design_id" uuid;

DO $$ BEGIN
  ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_linked_design_id_designs_id_fk"
    FOREIGN KEY ("linked_design_id") REFERENCES "public"."designs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "hero_slides_linked_design_idx"
  ON "hero_slides" USING btree ("linked_design_id");

DO $$ BEGIN
  ALTER TYPE "public"."discount_applies_to" ADD VALUE IF NOT EXISTS 'CATEGORY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
`);
  await sql1.end({ timeout: 5 });

  // Connection 2: migrate COLLECTION → CATEGORY after enum commit
  const sql2 = postgres(url, { max: 1 });
  await sql2.unsafe(`
UPDATE "discounts"
SET "applies_to" = 'CATEGORY'
WHERE "applies_to" = 'COLLECTION';
`);
  await sql2.end({ timeout: 5 });
  console.log("content settings schema ensured");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
