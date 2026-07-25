CREATE TABLE "size_block_cells" (
	"block_id" uuid NOT NULL,
	"measurement_key" text NOT NULL,
	"size_label" text NOT NULL,
	"value" integer NOT NULL,
	"is_pinned" boolean DEFAULT true NOT NULL,
	"edited_by_id" uuid,
	"edited_at" timestamp with time zone,
	CONSTRAINT "size_block_cells_block_id_measurement_key_size_label_pk" PRIMARY KEY("block_id","measurement_key","size_label")
);
--> statement-breakpoint
CREATE TABLE "size_block_rows" (
	"id" uuid PRIMARY KEY NOT NULL,
	"block_id" uuid NOT NULL,
	"measurement_key" text NOT NULL,
	"base_value" integer NOT NULL,
	"grade_increment" integer NOT NULL,
	"grade_overrides" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "size_blocks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category_id" uuid NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"owner_design_id" uuid,
	"size_labels" text[] NOT NULL,
	"base_size_label" text NOT NULL,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "size_block_cells" ADD CONSTRAINT "size_block_cells_block_id_size_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."size_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "size_block_cells" ADD CONSTRAINT "size_block_cells_edited_by_id_users_id_fk" FOREIGN KEY ("edited_by_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "size_block_rows" ADD CONSTRAINT "size_block_rows_block_id_size_blocks_id_fk" FOREIGN KEY ("block_id") REFERENCES "public"."size_blocks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "size_blocks" ADD CONSTRAINT "size_blocks_category_id_garment_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."garment_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "size_block_rows_block_key_uidx" ON "size_block_rows" USING btree ("block_id","measurement_key");