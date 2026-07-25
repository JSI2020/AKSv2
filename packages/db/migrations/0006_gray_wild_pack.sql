CREATE TABLE "fit_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"ease_by_measurement" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cling_factor_bps" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"notes" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fit_profiles" ADD CONSTRAINT "fit_profiles_category_id_garment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;