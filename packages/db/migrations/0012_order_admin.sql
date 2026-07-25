CREATE TYPE "public"."order_payment_kind" AS ENUM('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."order_payment_provider" AS ENUM('BANK_TRANSFER', 'CASH', 'JAZZCASH', 'EASYPAISA', 'COD', 'SAFEPAY', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."order_payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'AWAITING_VERIFICATION', 'REFUNDED');--> statement-breakpoint
CREATE TABLE "order_payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "order_payment_kind" NOT NULL,
	"amount_minor" integer NOT NULL,
	"provider" "order_payment_provider" NOT NULL,
	"status" "order_payment_status" DEFAULT 'SUCCEEDED' NOT NULL,
	"note" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"asset_id" uuid NOT NULL,
	"is_customer_visible" boolean DEFAULT false NOT NULL,
	"uploaded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_payments" ADD CONSTRAINT "order_payments_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_uploaded_by_id_users_id_fk" FOREIGN KEY ("uploaded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_photos" ADD CONSTRAINT "order_photos_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
