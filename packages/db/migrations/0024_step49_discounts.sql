CREATE TYPE "public"."discount_type" AS ENUM('PERCENTAGE', 'FIXED_AMOUNT', 'FREE_SHIPPING');--> statement-breakpoint
CREATE TYPE "public"."discount_applies_to" AS ENUM('ORDER', 'COLLECTION', 'DESIGN', 'GARMENT_TYPE');--> statement-breakpoint
CREATE TYPE "public"."discount_status" AS ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED');--> statement-breakpoint
CREATE TABLE "discounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text,
	"name" text NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" integer NOT NULL,
	"applies_to" "discount_applies_to" NOT NULL,
	"target_ids" text[] DEFAULT '{}' NOT NULL,
	"min_spend_minor" integer DEFAULT 0 NOT NULL,
	"max_discount_minor" integer,
	"first_order_only" boolean DEFAULT false NOT NULL,
	"once_per_customer" boolean DEFAULT false NOT NULL,
	"usage_limit" integer,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"stackable" boolean DEFAULT false NOT NULL,
	"status" "discount_status" DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discounts_code_uidx" ON "discounts" USING btree ("code");--> statement-breakpoint
CREATE TABLE "discount_redemptions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"discount_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"user_id" uuid,
	"guest_email" text,
	"amount_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_discount_id_discounts_id_fk" FOREIGN KEY ("discount_id") REFERENCES "public"."discounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discount_redemptions" ADD CONSTRAINT "discount_redemptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "discount_breakdown_snapshot" jsonb;
