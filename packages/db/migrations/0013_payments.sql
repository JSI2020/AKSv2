CREATE TYPE "public"."payment_provider" AS ENUM('SAFEPAY', 'JAZZCASH', 'EASYPAISA', 'BANK_TRANSFER', 'COD', 'CASH');--> statement-breakpoint
CREATE TYPE "public"."payment_kind" AS ENUM('DEPOSIT', 'BALANCE', 'FULL', 'REFUND');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'AWAITING_VERIFICATION');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_ref" text,
	"kind" "payment_kind" NOT NULL,
	"amount_minor" integer NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"status" "payment_status" NOT NULL,
	"raw_payload" jsonb,
	"idempotency_key" text NOT NULL,
	"receipt_asset_id" uuid,
	"verified_by_id" uuid,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_key_unique" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" uuid PRIMARY KEY NOT NULL,
	"payment_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"amount_minor" integer NOT NULL,
	"reason" text NOT NULL,
	"status" "refund_status" NOT NULL,
	"provider_ref" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_receipt_asset_id_assets_id_fk" FOREIGN KEY ("receipt_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_verified_by_id_users_id_fk" FOREIGN KEY ("verified_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
