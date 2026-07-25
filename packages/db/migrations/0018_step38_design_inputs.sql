-- Step 38: design inputs, attestations, sketch preprocessing support

CREATE TYPE "public"."design_input_role" AS ENUM(
  'SKETCH_FRONT',
  'SKETCH_BACK',
  'SKETCH_SIDE',
  'SKETCH_DETAIL',
  'TECHNICAL_FLAT',
  'FABRIC_SWATCH',
  'REFERENCE_OWN',
  'REFERENCE_EXTERNAL'
);--> statement-breakpoint

ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "external_references_flagged" boolean DEFAULT false NOT NULL;--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "design_input_attestations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"statement" text NOT NULL,
	"version" integer NOT NULL,
	"attested_by_id" uuid NOT NULL,
	"attested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "design_inputs" (
	"id" uuid PRIMARY KEY NOT NULL,
	"design_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"role" "design_input_role" NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"derived_asset_id" uuid,
	"attestation_id" uuid,
	"purge_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "design_input_attestations" ADD CONSTRAINT "design_input_attestations_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_input_attestations" ADD CONSTRAINT "design_input_attestations_attested_by_id_users_id_fk" FOREIGN KEY ("attested_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_inputs" ADD CONSTRAINT "design_inputs_design_id_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_inputs" ADD CONSTRAINT "design_inputs_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_inputs" ADD CONSTRAINT "design_inputs_derived_asset_id_assets_id_fk" FOREIGN KEY ("derived_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "design_inputs" ADD CONSTRAINT "design_inputs_attestation_id_design_input_attestations_id_fk" FOREIGN KEY ("attestation_id") REFERENCES "public"."design_input_attestations"("id") ON DELETE no action ON UPDATE no action;
