-- Photoreal sketch tool tables + design compare-at sale columns
-- (previously only applied via db:ensure:photoreal / drizzle-kit push)

ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "compare_at_price_minor" integer;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "compare_at_starts_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "compare_at_ends_at" timestamp with time zone;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "photoreal_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"preferred_house_model_id" text NOT NULL,
	"generate_model" text NOT NULL,
	"refine_model" text NOT NULL,
	"lock_seed" boolean DEFAULT true NOT NULL,
	"monthly_spend_reminder_usd_cents" integer,
	"persona_description" text NOT NULL,
	"persona_seed" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "photoreal_designs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"title" text,
	"description" text,
	"shirt_colour" text,
	"trouser_colour" text,
	"fabric" text,
	"sketch_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"old_design_url" text,
	"house_model_id" text,
	"house_model_name" text,
	"total_cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"created_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "photoreal_designs" ADD CONSTRAINT "photoreal_designs_created_by_id_users_id_fk"
		FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "photoreal_versions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"parent_version_id" uuid,
	"image_url" text NOT NULL,
	"prompt" text NOT NULL,
	"negative_prompt" text,
	"seed" integer,
	"model_id" text NOT NULL,
	"feedback" text,
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN
	ALTER TABLE "photoreal_versions" ADD CONSTRAINT "photoreal_versions_design_id_photoreal_designs_id_fk"
		FOREIGN KEY ("design_id") REFERENCES "public"."photoreal_designs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
