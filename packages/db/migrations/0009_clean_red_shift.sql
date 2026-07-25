CREATE TABLE "custom_size_limits" (
	"id" uuid PRIMARY KEY NOT NULL,
	"category_id" uuid NOT NULL,
	"measurement_key" text NOT NULL,
	"min_value" integer NOT NULL,
	"max_value" integer NOT NULL,
	"step" integer DEFAULT 25 NOT NULL,
	"cross_field_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_measurement_profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"label" text NOT NULL,
	"category_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_measurements" (
	"id" uuid PRIMARY KEY NOT NULL,
	"profile_id" uuid NOT NULL,
	"measurement_key" text NOT NULL,
	"value_inches" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_flow_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"user_id" uuid,
	"anon_token" text,
	"current_step_index" integer DEFAULT 0 NOT NULL,
	"acknowledged_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"save_to_profile" boolean DEFAULT false NOT NULL,
	"profile_label" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "measurement_flow_values" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"component_key" text NOT NULL,
	"measurement_key" text NOT NULL,
	"value_inches" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "custom_size_limits" ADD CONSTRAINT "custom_size_limits_category_id_garment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_size_limits" ADD CONSTRAINT "custom_size_limits_measurement_key_measurement_keys_key_fk" FOREIGN KEY ("measurement_key") REFERENCES "public"."measurement_keys"("key") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurement_profiles" ADD CONSTRAINT "customer_measurement_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurement_profiles" ADD CONSTRAINT "customer_measurement_profiles_category_id_garment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_measurements" ADD CONSTRAINT "customer_measurements_profile_id_customer_measurement_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."customer_measurement_profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_flow_sessions" ADD CONSTRAINT "measurement_flow_sessions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_flow_sessions" ADD CONSTRAINT "measurement_flow_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "measurement_flow_values" ADD CONSTRAINT "measurement_flow_values_session_id_measurement_flow_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."measurement_flow_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "custom_size_limits_category_key_uidx" ON "custom_size_limits" USING btree ("category_id","measurement_key");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_measurements_profile_key_uidx" ON "customer_measurements" USING btree ("profile_id","measurement_key");--> statement-breakpoint
CREATE UNIQUE INDEX "measurement_flow_values_session_key_uidx" ON "measurement_flow_values" USING btree ("session_id","component_key","measurement_key");