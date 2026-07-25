CREATE TYPE "public"."staff_role" AS ENUM('CUTTER', 'STITCHER', 'EMBROIDERER', 'FINISHER', 'QC');--> statement-breakpoint
CREATE TYPE "public"."production_job_stage" AS ENUM('CUTTING', 'STITCHING', 'EMBROIDERY', 'FINISHING', 'QC', 'PACKED');--> statement-breakpoint
CREATE TYPE "public"."production_job_status" AS ENUM('PENDING', 'IN_PROGRESS', 'BLOCKED', 'DONE');--> statement-breakpoint
CREATE TYPE "public"."qc_check_result" AS ENUM('PASS', 'FAIL');--> statement-breakpoint
CREATE TYPE "public"."rework_fault_attribution" AS ENUM('OUR_ERROR', 'CUSTOMER_MEASUREMENT', 'FABRIC_DEFECT', 'UNDETERMINED');--> statement-breakpoint
CREATE TYPE "public"."rework_order_status" AS ENUM('PENDING', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "staff" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"role" "staff_role" NOT NULL,
	"capacity_per_week" integer DEFAULT 5 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "staff" ADD CONSTRAINT "staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "production_jobs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_item_id" uuid NOT NULL,
	"stage" "production_job_stage" DEFAULT 'CUTTING' NOT NULL,
	"assigned_to_id" uuid,
	"status" "production_job_status" DEFAULT 'PENDING' NOT NULL,
	"due_at" timestamp with time zone,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"blocked_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_jobs" ADD CONSTRAINT "production_jobs_assigned_to_id_staff_id_fk" FOREIGN KEY ("assigned_to_id") REFERENCES "public"."staff"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "production_jobs_order_item_active_uidx" ON "production_jobs" ("order_item_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "production_job_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"from_stage" "production_job_stage" NOT NULL,
	"to_stage" "production_job_stage" NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "production_job_events" ADD CONSTRAINT "production_job_events_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_job_events" ADD CONSTRAINT "production_job_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "production_job_events_job_id_idx" ON "production_job_events" ("job_id");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "qc_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"job_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"checklist" jsonb NOT NULL,
	"result" "qc_check_result" NOT NULL,
	"photo_asset_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"inspector_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "qc_checks" ADD CONSTRAINT "qc_checks_job_id_production_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."production_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_checks" ADD CONSTRAINT "qc_checks_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qc_checks" ADD CONSTRAINT "qc_checks_inspector_id_users_id_fk" FOREIGN KEY ("inspector_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "rework_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"original_order_item_id" uuid NOT NULL,
	"original_job_id" uuid,
	"reason" text NOT NULL,
	"fault_attribution" "rework_fault_attribution" NOT NULL,
	"cost_minor" integer DEFAULT 0 NOT NULL,
	"charge_customer" boolean DEFAULT false NOT NULL,
	"status" "rework_order_status" DEFAULT 'PENDING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);--> statement-breakpoint

ALTER TABLE "rework_orders" ADD CONSTRAINT "rework_orders_original_order_item_id_order_items_id_fk" FOREIGN KEY ("original_order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rework_orders" ADD CONSTRAINT "rework_orders_original_job_id_production_jobs_id_fk" FOREIGN KEY ("original_job_id") REFERENCES "public"."production_jobs"("id") ON DELETE set null ON UPDATE no action;
