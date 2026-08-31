-- Manual placement of the measurement lines drawn over a design's ghost
-- mannequin. The ghost is generated, so its proportions differ every time and
-- formula-placed lines cannot sit correctly on every image. Positions are
-- normalized (0-1) against the ghost so they survive any render size, and are
-- independent of the measurement values themselves.
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "sizing_overlay" jsonb;
