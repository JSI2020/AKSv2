-- Step 36: design_generations append-only ledger for fal.ai jobs

CREATE TYPE "public"."design_generation_stage" AS ENUM('HERO', 'ANGLE', 'COLOURWAY');--> statement-breakpoint
CREATE TYPE "public"."design_generation_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."design_generation_decision" AS ENUM('PENDING', 'APPROVED', 'REJECTED');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "design_generations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"stage" "design_generation_stage" NOT NULL,
	"angle" text,
	"colourway_id" uuid,
	"parent_generation_id" uuid,
	"archetype_id" uuid,
	"size_block_snapshot" jsonb,
	"provider" text DEFAULT 'fal' NOT NULL,
	"model_id" text NOT NULL,
	"prompt_json" jsonb NOT NULL,
	"negative_prompt" text,
	"seed" integer,
	"template_version" integer NOT NULL,
	"input_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"output_asset_id" uuid,
	"status" "design_generation_status" DEFAULT 'PENDING' NOT NULL,
	"cost_usd_micros" integer,
	"latency_ms" integer,
	"error" text,
	"idempotency_key" text NOT NULL,
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"decision" "design_generation_decision" DEFAULT 'PENDING' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_generations_idempotency_key_unique" UNIQUE("idempotency_key")
);--> statement-breakpoint

ALTER TABLE "design_generations" ADD CONSTRAINT "design_generations_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_generations" ADD CONSTRAINT "design_generations_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_generations" ADD CONSTRAINT "design_generations_archetype_id_house_models_id_fk" FOREIGN KEY ("archetype_id") REFERENCES "public"."house_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_generations" ADD CONSTRAINT "design_generations_output_asset_id_assets_id_fk" FOREIGN KEY ("output_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_generations" ADD CONSTRAINT "design_generations_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
