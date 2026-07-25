CREATE TYPE "public"."drape_class" AS ENUM('LIGHT', 'MEDIUM', 'HEAVY');--> statement-breakpoint
CREATE TABLE "fabrics" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"composition" text NOT NULL,
	"weight_gsm" integer,
	"width_inches" integer NOT NULL,
	"swatch_asset_id" uuid,
	"care_instructions" text,
	"drape_notes" text,
	"cost_per_meter_minor" integer DEFAULT 0 NOT NULL,
	"stretch_percent" integer DEFAULT 0 NOT NULL,
	"shrinkage_allowance" integer DEFAULT 0 NOT NULL,
	"drape_class" "drape_class" DEFAULT 'MEDIUM' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "house_models" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"height_cm" integer NOT NULL,
	"height_inches" integer NOT NULL,
	"bust" integer NOT NULL,
	"waist" integer NOT NULL,
	"hip" integer NOT NULL,
	"shoulder" integer NOT NULL,
	"wears_size_label" text NOT NULL,
	"build_description" text,
	"identity_seed" text NOT NULL,
	"reference_asset_ids" uuid[] DEFAULT '{}' NOT NULL,
	"is_ai_generated" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fabrics" ADD CONSTRAINT "fabrics_swatch_asset_id_assets_id_fk" FOREIGN KEY ("swatch_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;