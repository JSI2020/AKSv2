-- Whether a ghost-mannequin render makes sense for this garment category.
-- The ghost is an upper-body form (shoulder line, armhole, neckline); a
-- trouser or skirt has nothing to hang from. Made a category property so the
-- house can change it from Settings instead of it living in code.
ALTER TABLE "garment_categories"
  ADD COLUMN IF NOT EXISTS "requires_ghost_mannequin" boolean NOT NULL DEFAULT true;

-- Seed from the body region: bottoms and flat drapes take no ghost.
UPDATE "garment_categories" SET "requires_ghost_mannequin" = false
WHERE upper("key") IN (
  'TROUSER','PANT','PALAZZO','SHALWAR','CAPRI','CULOTTE','SHARARA','GHARARA',
  'SKIRT','LEHENGA',
  'DUPATTA','SHAWL','SAREE','UNSTITCHED_1PC','UNSTITCHED_2PC','UNSTITCHED_3PC'
);
