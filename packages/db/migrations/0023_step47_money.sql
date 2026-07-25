CREATE TYPE "public"."rate_kind" AS ENUM('STITCHING', 'EMBROIDERY', 'PACKAGING');--> statement-breakpoint
CREATE TYPE "public"."rate_unit" AS ENUM('FLAT', 'PER_HOUR', 'PER_METRE');--> statement-breakpoint
CREATE TYPE "public"."recurring_cost_cycle" AS ENUM('WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');--> statement-breakpoint
CREATE TABLE "rates" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" "rate_kind" NOT NULL,
	"name" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"unit" "rate_unit" NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_costs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"amount_minor" integer NOT NULL,
	"cycle" "recurring_cost_cycle" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "design_costs" (
	"design_id" uuid PRIMARY KEY NOT NULL,
	"fabric_id" uuid NOT NULL,
	"fabric_meters" integer DEFAULT 0 NOT NULL,
	"embroidery_rate_id" uuid,
	"embroidery_flat_minor" integer,
	"stitching_rate_id" uuid,
	"stitching_flat_minor" integer,
	"packaging_minor" integer DEFAULT 0 NOT NULL,
	"ai_cost_minor" integer DEFAULT 0 NOT NULL,
	"total_cost_minor" integer DEFAULT 0 NOT NULL,
	"selling_price_minor" integer DEFAULT 0 NOT NULL,
	"margin_percent" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_embroidery_rate_id_rates_id_fk" FOREIGN KEY ("embroidery_rate_id") REFERENCES "public"."rates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_costs" ADD CONSTRAINT "design_costs_stitching_rate_id_rates_id_fk" FOREIGN KEY ("stitching_rate_id") REFERENCES "public"."rates"("id") ON DELETE no action ON UPDATE no action;
