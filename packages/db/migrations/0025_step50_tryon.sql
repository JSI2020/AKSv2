CREATE TYPE "public"."tryon_session_status" AS ENUM('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'UNAVAILABLE');--> statement-breakpoint
CREATE TABLE "tryon_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"model_id" text NOT NULL,
	"consent_version" integer DEFAULT 1 NOT NULL,
	"anon_daily_limit" integer DEFAULT 3 NOT NULL,
	"signed_in_daily_limit" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tryon_consents" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"anon_id" text,
	"version" integer NOT NULL,
	"granted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uploaded_selfies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"consent_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"face_embedding_ref" text,
	"purge_at" timestamp with time zone NOT NULL,
	"purged_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tryon_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"consent_id" uuid NOT NULL,
	"selfie_id" uuid NOT NULL,
	"design_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"archetype_id" uuid,
	"user_id" uuid,
	"anon_id" text,
	"status" "tryon_session_status" DEFAULT 'PENDING' NOT NULL,
	"face_cache_key" text NOT NULL,
	"added_to_cart_at" timestamp with time zone,
	"cost_usd_micros" integer,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tryon_results" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"angle" "render_angle" NOT NULL,
	"asset_id" uuid NOT NULL,
	"cache_key" text NOT NULL,
	"cost_usd_micros" integer DEFAULT 0 NOT NULL,
	"from_cache" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "tryon_results_cache_key_angle_idx" ON "tryon_results" USING btree ("cache_key","angle");--> statement-breakpoint
CREATE INDEX "tryon_sessions_created_at_idx" ON "tryon_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "uploaded_selfies_purge_at_idx" ON "uploaded_selfies" USING btree ("purge_at");--> statement-breakpoint
ALTER TABLE "tryon_consents" ADD CONSTRAINT "tryon_consents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_selfies" ADD CONSTRAINT "uploaded_selfies_consent_id_tryon_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."tryon_consents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uploaded_selfies" ADD CONSTRAINT "uploaded_selfies_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_consent_id_tryon_consents_id_fk" FOREIGN KEY ("consent_id") REFERENCES "public"."tryon_consents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_selfie_id_uploaded_selfies_id_fk" FOREIGN KEY ("selfie_id") REFERENCES "public"."uploaded_selfies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_archetype_id_house_models_id_fk" FOREIGN KEY ("archetype_id") REFERENCES "public"."house_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_sessions" ADD CONSTRAINT "tryon_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_results" ADD CONSTRAINT "tryon_results_session_id_tryon_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."tryon_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tryon_results" ADD CONSTRAINT "tryon_results_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
