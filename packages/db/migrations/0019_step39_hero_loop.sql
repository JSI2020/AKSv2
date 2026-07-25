-- Step 39: studio pipeline statuses + design_locks for hero approval

ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'BRIEF_COMPLETE';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'INPUTS_UPLOADED';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'HERO_GENERATING';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'HERO_REVIEW';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'HERO_LOCKED';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'SIZING';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'SIZING_LOCKED';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'ANGLES_GENERATING';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'ANGLES_REVIEW';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'ANGLES_LOCKED';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'COLOURWAYS_GENERATING';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'COLOURWAYS_REVIEW';--> statement-breakpoint
ALTER TYPE "public"."design_status" ADD VALUE IF NOT EXISTS 'READY_TO_PUBLISH';--> statement-breakpoint

CREATE TYPE "public"."design_lock_stage" AS ENUM('HERO', 'SIZING', 'ANGLE', 'COLOURWAY');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "design_locks" (
	"design_id" uuid NOT NULL,
	"stage" "design_lock_stage" NOT NULL,
	"generation_id" uuid NOT NULL,
	"locked_by" uuid NOT NULL,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "design_locks_design_id_stage_pk" PRIMARY KEY("design_id","stage")
);--> statement-breakpoint

ALTER TABLE "design_locks" ADD CONSTRAINT "design_locks_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_locks" ADD CONSTRAINT "design_locks_generation_id_design_generations_id_fk" FOREIGN KEY ("generation_id") REFERENCES "public"."design_generations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_locks" ADD CONSTRAINT "design_locks_locked_by_users_id_fk" FOREIGN KEY ("locked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
