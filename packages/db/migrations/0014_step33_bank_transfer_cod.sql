CREATE TABLE "customer_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"whatsapp_number" text,
	"cod_refusal_count" integer DEFAULT 0 NOT NULL,
	"cod_disabled" boolean DEFAULT false NOT NULL,
	"total_orders_count" integer DEFAULT 0 NOT NULL,
	"lifetime_value_minor" integer DEFAULT 0 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"internal_notes" text,
	"accepts_marketing" boolean DEFAULT false NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cod_remittances" (
	"id" uuid PRIMARY KEY NOT NULL,
	"courier" text NOT NULL,
	"remittance_ref" text NOT NULL,
	"expected_amount_minor" integer NOT NULL,
	"received_amount_minor" integer NOT NULL,
	"received_at" timestamp with time zone NOT NULL,
	"order_ids" jsonb NOT NULL,
	"discrepancy_note" text,
	"recorded_by_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cod_remittances" ADD CONSTRAINT "cod_remittances_recorded_by_id_users_id_fk" FOREIGN KEY ("recorded_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
