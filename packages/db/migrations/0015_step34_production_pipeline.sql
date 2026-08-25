-- Step 34: granular production pipeline, message templates, message log
-- NOTE: enum ADD VALUE must commit before any UPDATE that uses the new labels.
-- The IN_PRODUCTION → CUTTING backfill lives in 0035_order_status_cutting_backfill.sql.

ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'CUTTING';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'STITCHING';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'EMBROIDERY';--> statement-breakpoint
ALTER TYPE "public"."order_status" ADD VALUE IF NOT EXISTS 'FINISHING';--> statement-breakpoint

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "skip_embroidery" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TYPE "public"."message_channel" AS ENUM('EMAIL');--> statement-breakpoint
CREATE TYPE "public"."message_log_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'DEAD');--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "message_templates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"channel" "message_channel" DEFAULT 'EMAIL' NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "message_templates_key_channel_locale_version_uidx" ON "message_templates" ("key","channel","locale","version");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "message_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"recipient" text NOT NULL,
	"template_key" text NOT NULL,
	"order_id" uuid REFERENCES "orders"("id") ON DELETE SET NULL,
	"status" "message_log_status" DEFAULT 'PENDING' NOT NULL,
	"provider_ref" text,
	"sent_at" timestamp with time zone,
	"error" text,
	"outbox_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "message_log_order_id_idx" ON "message_log" ("order_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "message_log_status_idx" ON "message_log" ("status");
