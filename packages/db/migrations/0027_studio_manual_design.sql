-- Manual Studio designs: offered sizes + MTM flag on catalogue
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "available_size_labels" text[] DEFAULT '{}' NOT NULL;
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "made_to_measure_offered" boolean DEFAULT true NOT NULL;
