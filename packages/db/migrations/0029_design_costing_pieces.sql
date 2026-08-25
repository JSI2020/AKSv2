ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "overhead_minor" integer DEFAULT 0 NOT NULL;
ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "costing_mode" text DEFAULT 'DETAILED_PER_PIECE' NOT NULL;
ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "piece_costs" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "design_costs" ADD COLUMN IF NOT EXISTS "total_lumpsum_minor" integer;
