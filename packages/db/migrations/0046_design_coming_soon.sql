-- "Coming soon": a published design shown in the shop as a preview —
-- visible and browsable, but not purchasable yet. The note is optional
-- customer-facing copy such as "Arriving December".
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "coming_soon" boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "coming_soon_note" text;
