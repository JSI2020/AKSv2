CREATE TYPE "public"."body_or_garment" AS ENUM('BODY', 'GARMENT');--> statement-breakpoint
CREATE TABLE "garment_categories" (
	"id" uuid PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text NOT NULL,
	"measurement_keys" text[] NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garment_categories_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "measurement_keys" (
	"key" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"label_ur" text NOT NULL,
	"body_or_garment" "body_or_garment" NOT NULL,
	"anchor_point" text NOT NULL,
	"help_text" text NOT NULL,
	"demo_video_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "measurement_keys" ADD CONSTRAINT "measurement_keys_demo_video_asset_id_assets_id_fk" FOREIGN KEY ("demo_video_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;