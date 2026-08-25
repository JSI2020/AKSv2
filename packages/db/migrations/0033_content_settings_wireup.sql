-- Content settings: hero linked design + discount CATEGORY scope

ALTER TABLE "hero_slides" ADD COLUMN IF NOT EXISTS "linked_design_id" uuid;

DO $$ BEGIN
  ALTER TABLE "hero_slides" ADD CONSTRAINT "hero_slides_linked_design_id_designs_id_fk"
    FOREIGN KEY ("linked_design_id") REFERENCES "public"."designs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "hero_slides_linked_design_idx"
  ON "hero_slides" USING btree ("linked_design_id");

-- CATEGORY for house-door scoped discounts (COLLECTION kept for legacy rows)
-- NOTE: ADD VALUE must be committed before UPDATE — ensure script runs two connections.
DO $$ BEGIN
  ALTER TYPE "public"."discount_applies_to" ADD VALUE IF NOT EXISTS 'CATEGORY';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
