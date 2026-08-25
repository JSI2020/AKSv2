-- Studio design editor revamp columns
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "item_number" text;
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "studio_angle_picks" text[] DEFAULT '{}' NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "designs_item_number_uidx"
  ON "designs" ("item_number")
  WHERE "item_number" IS NOT NULL;

ALTER TABLE "colourways" ADD COLUMN IF NOT EXISTS "piece_fabrics" jsonb DEFAULT '{}'::jsonb NOT NULL;

ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "shipping_minor" integer DEFAULT 0 NOT NULL;
