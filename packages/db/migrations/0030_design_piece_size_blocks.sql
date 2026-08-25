ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "piece_size_blocks" jsonb DEFAULT '{}'::jsonb NOT NULL;
