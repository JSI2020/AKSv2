CREATE TYPE "public"."cart_size_mode" AS ENUM('STANDARD', 'MADE_TO_MEASURE');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('ACTIVE', 'CONVERTED', 'ABANDONED');--> statement-breakpoint
CREATE TYPE "public"."pakistan_province" AS ENUM('PUNJAB', 'SINDH', 'KPK', 'BALOCHISTAN', 'GILGIT_BALTISTAN', 'AJK', 'ICT');--> statement-breakpoint
CREATE TYPE "public"."order_size_mode" AS ENUM('STANDARD', 'MADE_TO_MEASURE');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('WEB', 'WHATSAPP', 'INSTAGRAM', 'PHONE', 'WALK_IN');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('DRAFT', 'AWAITING_DEPOSIT', 'DEPOSIT_PAID', 'MEASUREMENTS_CONFIRMED', 'IN_PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP', 'DISPATCHED', 'DELIVERED', 'COMPLETED', 'CANCELLED', 'REFUND_PENDING', 'REFUNDED', 'DELIVERY_REFUSED', 'WRITE_OFF');--> statement-breakpoint
CREATE TYPE "public"."payment_plan" AS ENUM('FULL_PREPAID', 'DEPOSIT_50_COD_50', 'DEPOSIT_70_COD_30');--> statement-breakpoint
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
CREATE TABLE "addresses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text,
	"recipient_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"province" "pakistan_province" NOT NULL,
	"postal_code" text,
	"landmark" text,
	"is_default_shipping" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"entity_id" uuid NOT NULL,
	"from_status" text NOT NULL,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"design_snapshot" jsonb NOT NULL,
	"size_mode" "order_size_mode" NOT NULL,
	"size_label" text,
	"measurement_snapshot" jsonb NOT NULL,
	"customization_snapshot" jsonb NOT NULL,
	"price_breakdown_snapshot" jsonb NOT NULL,
	"cut_spec_snapshot" jsonb,
	"unit_price_minor" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_number" text NOT NULL,
	"user_id" uuid,
	"guest_email" text,
	"guest_phone" text,
	"whatsapp_number" text NOT NULL,
	"status" "order_status" DEFAULT 'DRAFT' NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"subtotal_minor" integer NOT NULL,
	"discount_minor" integer DEFAULT 0 NOT NULL,
	"shipping_minor" integer DEFAULT 0 NOT NULL,
	"tax_minor" integer DEFAULT 0 NOT NULL,
	"total_minor" integer NOT NULL,
	"deposit_amount_minor" integer NOT NULL,
	"balance_amount_minor" integer NOT NULL,
	"payment_plan" "payment_plan" NOT NULL,
	"promised_ship_date" timestamp with time zone,
	"shipping_address_snapshot" jsonb NOT NULL,
	"customer_notes" text,
	"internal_notes" text,
	"source" "order_source" DEFAULT 'WEB' NOT NULL,
	"cart_id" uuid,
	"placed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_lines" ADD CONSTRAINT "cart_lines_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;