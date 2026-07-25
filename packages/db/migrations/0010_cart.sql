CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CONVERTED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."cart_size_mode" AS ENUM('STANDARD', 'MADE_TO_MEASURE');--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"anon_id" text NOT NULL,
	"status" "cart_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"cart_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"size_mode" "cart_size_mode" NOT NULL,
	"size_label" text,
	"measurement_profile_id" uuid,
	"customization_selections" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE no action ON UPDATE no action;
