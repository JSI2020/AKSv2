CREATE TABLE IF NOT EXISTS "archetype_anchor_points" (
	"archetype_id" uuid NOT NULL,
	"category_key" text NOT NULL,
	"measurement_key" text NOT NULL,
	"anchor_y_bp" integer NOT NULL,
	CONSTRAINT "archetype_anchor_points_archetype_id_category_key_measurement_key_pk" PRIMARY KEY("archetype_id","category_key","measurement_key")
);
--> statement-breakpoint
ALTER TABLE "archetype_anchor_points" ADD CONSTRAINT "archetype_anchor_points_archetype_id_house_models_id_fk" FOREIGN KEY ("archetype_id") REFERENCES "public"."house_models"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_generations" ADD COLUMN IF NOT EXISTS "output_meta" jsonb;
