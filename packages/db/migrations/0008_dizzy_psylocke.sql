CREATE TYPE "public"."customization_input_type" AS ENUM('SELECT', 'BOOLEAN');--> statement-breakpoint
CREATE TYPE "public"."design_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."design_tag_kind" AS ENUM('OCCASION', 'SEASON', 'WORK', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."render_angle" AS ENUM('FRONT', 'THREE_QUARTER', 'BACK', 'DETAIL');--> statement-breakpoint
CREATE TABLE "colourways" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ur" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"fabric_id" uuid NOT NULL,
	"hex_approximation" text,
	"price_delta_minor" integer DEFAULT 0 NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_option_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"option_id" uuid NOT NULL,
	"value" text NOT NULL,
	"label" text NOT NULL,
	"label_ur" text DEFAULT '' NOT NULL,
	"price_delta_minor" integer DEFAULT 0 NOT NULL,
	"reference_asset_id" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customization_options" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid,
	"category_id" uuid,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"label_ur" text DEFAULT '' NOT NULL,
	"input_type" "customization_input_type" DEFAULT 'SELECT' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_renders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"angle" "render_angle" NOT NULL,
	"archetype_id" uuid,
	"asset_id" uuid NOT NULL,
	"is_ai_generated" boolean DEFAULT false NOT NULL,
	"alt_text" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_tags" (
	"design_id" uuid NOT NULL,
	"kind" "design_tag_kind" NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "design_tags_design_id_kind_value_pk" PRIMARY KEY("design_id","kind","value")
);
--> statement-breakpoint
CREATE TABLE "designs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"name_ur" text DEFAULT '' NOT NULL,
	"description" text,
	"story_copy" text,
	"status" "design_status" DEFAULT 'DRAFT' NOT NULL,
	"garment_type_id" uuid NOT NULL,
	"components" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"size_block_id" uuid,
	"fit_profile_ids" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"base_price_minor" integer DEFAULT 0 NOT NULL,
	"made_to_measure_surcharge_minor" integer DEFAULT 0 NOT NULL,
	"fabric_consumption_meters" integer DEFAULT 0 NOT NULL,
	"lead_time_days_override" integer,
	"featured" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"og_asset_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "designs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "colourways" ADD CONSTRAINT "colourways_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colourways" ADD CONSTRAINT "colourways_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_option_values" ADD CONSTRAINT "customization_option_values_option_id_customization_options_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."customization_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_option_values" ADD CONSTRAINT "customization_option_values_reference_asset_id_assets_id_fk" FOREIGN KEY ("reference_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customization_options" ADD CONSTRAINT "customization_options_category_id_garment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_renders" ADD CONSTRAINT "design_renders_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_renders" ADD CONSTRAINT "design_renders_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_renders" ADD CONSTRAINT "design_renders_archetype_id_house_models_id_fk" FOREIGN KEY ("archetype_id") REFERENCES "public"."house_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_renders" ADD CONSTRAINT "design_renders_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_tags" ADD CONSTRAINT "design_tags_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_garment_type_id_garment_categories_id_fk" FOREIGN KEY ("garment_type_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_size_block_id_size_blocks_id_fk" FOREIGN KEY ("size_block_id") REFERENCES "public"."size_blocks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "designs" ADD CONSTRAINT "designs_og_asset_id_assets_id_fk" FOREIGN KEY ("og_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "colourways_design_slug_uidx" ON "colourways" USING btree ("design_id","slug");