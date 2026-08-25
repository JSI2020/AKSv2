DO $$ BEGIN CREATE TYPE "dress_standard_size" AS ENUM ('XS','S','M','L','XL','XXL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_body_dimension" AS ENUM ('bust','waist','hip','shoulder','height'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_fit_weight_dimension" AS ENUM ('bust','waist','hip','height'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_garment_type" AS ENUM ('short_shirt','long_gown','kurti','vest_palazzo','trouser'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_style_category" AS ENUM ('essentials','modern_tailored','occasion','signature','separates'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_pom_key" AS ENUM ('chest','waist','hip','shoulder','sleeveLength','garmentLength','hemWidth','neckDrop'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_pom_kind" AS ENUM ('girth','design'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_length_band" AS ENUM ('above_knee','knee','below_knee','ankle','floor'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_fit_intent" AS ENUM ('fitted','semi_fitted','relaxed','oversized'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_style_status" AS ENUM ('draft','published'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_recognition_status" AS ENUM ('proposed','confirmed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_fit_outcome" AS ENUM ('kept','returned','exchanged'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN CREATE TYPE "dress_fit_reason" AS ENUM ('too_tight','too_loose','too_short','too_long','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dress_size_grid" (
  "id" uuid PRIMARY KEY NOT NULL, "name" text NOT NULL, "is_active" boolean DEFAULT false NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_size_grid_one_active_uidx" ON "dress_size_grid" ("is_active") WHERE "is_active" = true;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_size_grid_row" (
  "id" uuid PRIMARY KEY NOT NULL, "grid_id" uuid NOT NULL, "size" "dress_standard_size" NOT NULL,
  "bust" integer NOT NULL, "waist" integer NOT NULL, "hip" integer NOT NULL,
  "shoulder" integer NOT NULL, "height" integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_size_grid_row_grid_size_uidx" ON "dress_size_grid_row" ("grid_id","size");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dress_style_template" (
  "id" uuid PRIMARY KEY NOT NULL, "key" "dress_garment_type" NOT NULL,
  "category" "dress_style_category" NOT NULL, "base_size" "dress_standard_size" DEFAULT 'M' NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_style_template_key_uidx" ON "dress_style_template" ("key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_style_template_pom" (
  "id" uuid PRIMARY KEY NOT NULL, "template_id" uuid NOT NULL, "key" "dress_pom_key" NOT NULL,
  "kind" "dress_pom_kind" NOT NULL, "derived_from" "dress_body_dimension", "ease" integer,
  "base_value" integer, "grade_increment" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_style_template_pom_template_key_uidx" ON "dress_style_template_pom" ("template_id","key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_style_template_fit_weight" (
  "id" uuid PRIMARY KEY NOT NULL, "template_id" uuid NOT NULL,
  "dimension" "dress_fit_weight_dimension" NOT NULL, "weight" integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_style_template_fit_weight_uidx" ON "dress_style_template_fit_weight" ("template_id","dimension");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dress_style" (
  "id" uuid PRIMARY KEY NOT NULL, "name" text NOT NULL, "template_id" uuid,
  "category" "dress_style_category" NOT NULL, "base_size" "dress_standard_size" DEFAULT 'M' NOT NULL,
  "length_band" "dress_length_band" NOT NULL, "fit_intent" "dress_fit_intent" NOT NULL,
  "source_image_url" text, "recognition_confidence" double precision,
  "status" "dress_style_status" DEFAULT 'draft' NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_style_pom" (
  "id" uuid PRIMARY KEY NOT NULL, "style_id" uuid NOT NULL, "key" "dress_pom_key" NOT NULL,
  "kind" "dress_pom_kind" NOT NULL, "derived_from" "dress_body_dimension", "ease" integer,
  "base_value" integer, "grade_increment" integer DEFAULT 0 NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_style_pom_style_key_uidx" ON "dress_style_pom" ("style_id","key");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_style_fit_weight" (
  "id" uuid PRIMARY KEY NOT NULL, "style_id" uuid NOT NULL,
  "dimension" "dress_fit_weight_dimension" NOT NULL, "weight" integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "dress_style_fit_weight_uidx" ON "dress_style_fit_weight" ("style_id","dimension");--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "dress_recognition_proposal" (
  "id" uuid PRIMARY KEY NOT NULL, "image_url" text NOT NULL,
  "template_key" "dress_garment_type" NOT NULL, "length_band" "dress_length_band" NOT NULL,
  "fit_intent" "dress_fit_intent" NOT NULL, "confidence" double precision NOT NULL,
  "raw_json" jsonb NOT NULL, "status" "dress_recognition_status" DEFAULT 'proposed' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_generated_chart" (
  "style_id" uuid NOT NULL, "size" "dress_standard_size" NOT NULL,
  "pom_key" "dress_pom_key" NOT NULL, "value_hundredths" integer NOT NULL,
  CONSTRAINT "dress_generated_chart_pk" PRIMARY KEY ("style_id","size","pom_key")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "dress_fit_event" (
  "id" uuid PRIMARY KEY NOT NULL, "style_id" uuid NOT NULL, "size" "dress_standard_size" NOT NULL,
  "outcome" "dress_fit_outcome" NOT NULL, "reason" "dress_fit_reason" NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

DO $$ BEGIN ALTER TABLE "dress_size_grid_row" ADD CONSTRAINT "dress_size_grid_row_grid_id_fk" FOREIGN KEY ("grid_id") REFERENCES "dress_size_grid"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_style_template_pom" ADD CONSTRAINT "dress_style_template_pom_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "dress_style_template"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_style_template_fit_weight" ADD CONSTRAINT "dress_style_template_fit_weight_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "dress_style_template"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_style" ADD CONSTRAINT "dress_style_template_id_fk" FOREIGN KEY ("template_id") REFERENCES "dress_style_template"("id") ON DELETE set null; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_style_pom" ADD CONSTRAINT "dress_style_pom_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "dress_style"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_style_fit_weight" ADD CONSTRAINT "dress_style_fit_weight_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "dress_style"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_generated_chart" ADD CONSTRAINT "dress_generated_chart_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "dress_style"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN ALTER TABLE "dress_fit_event" ADD CONSTRAINT "dress_fit_event_style_id_fk" FOREIGN KEY ("style_id") REFERENCES "dress_style"("id") ON DELETE cascade; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN "dress_size_grid_row"."bust" IS 'hundredths of an inch';
COMMENT ON COLUMN "dress_size_grid_row"."waist" IS 'hundredths of an inch';
COMMENT ON COLUMN "dress_size_grid_row"."hip" IS 'hundredths of an inch';
COMMENT ON COLUMN "dress_size_grid_row"."shoulder" IS 'hundredths of an inch';
COMMENT ON COLUMN "dress_size_grid_row"."height" IS 'hundredths of an inch';
COMMENT ON COLUMN "dress_generated_chart"."value_hundredths" IS 'hundredths of an inch';
