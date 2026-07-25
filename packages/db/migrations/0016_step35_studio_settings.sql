-- Step 35: studio settings singleton + design prompt profiles

CREATE TYPE "public"."prompt_profile_origin" AS ENUM('SKETCH_LED', 'REFERENCE_LED', 'FABRIC_LED');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "studio_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"default_archetype_id" uuid,
	"default_base_size_label" text DEFAULT 'M' NOT NULL,
	"backdrop_lighting_profile" text NOT NULL,
	"default_ai_models" jsonb NOT NULL,
	"default_lead_time_days" integer DEFAULT 21 NOT NULL,
	"default_price_tier" text,
	"base_price_hint_minor" integer,
	"active_prompt_template_version" integer DEFAULT 1 NOT NULL,
	"monthly_spend_cap_usd_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "design_prompt_profiles" (
	"design_id" uuid PRIMARY KEY NOT NULL,
	"garment_description" text DEFAULT '' NOT NULL,
	"shirt_colour" text DEFAULT '' NOT NULL,
	"shirt_fabric" text DEFAULT '' NOT NULL,
	"trouser_colour" text DEFAULT '' NOT NULL,
	"trouser_fabric" text DEFAULT '' NOT NULL,
	"embroidery_description" text DEFAULT '' NOT NULL,
	"backdrop" text,
	"extra_notes" text,
	"template_version" integer DEFAULT 1 NOT NULL,
	"origin" "prompt_profile_origin" DEFAULT 'SKETCH_LED' NOT NULL,
	"combination_brief" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "studio_settings" ADD CONSTRAINT "studio_settings_default_archetype_id_house_models_id_fk" FOREIGN KEY ("default_archetype_id") REFERENCES "public"."house_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_prompt_profiles" ADD CONSTRAINT "design_prompt_profiles_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;
