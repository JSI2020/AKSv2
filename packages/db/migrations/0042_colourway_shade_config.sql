ALTER TABLE "colourways" ADD COLUMN "available_size_labels" text[] DEFAULT '{}' NOT NULL;
ALTER TABLE "colourways" ADD COLUMN "base_price_minor" integer;
ALTER TABLE "colourways" ADD COLUMN "compare_at_price_minor" integer;
ALTER TABLE "colourways" ADD COLUMN "costing_snapshot" jsonb;

UPDATE "colourways" cw
SET "available_size_labels" = d."available_size_labels"
FROM "designs" d
WHERE cw."design_id" = d."id"
  AND cardinality(d."available_size_labels") > 0;
