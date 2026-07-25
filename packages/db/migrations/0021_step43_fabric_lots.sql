CREATE TYPE "public"."fabric_lot_status" AS ENUM('AVAILABLE', 'LOW', 'DEPLETED', 'QUARANTINED');--> statement-breakpoint
CREATE TYPE "public"."fabric_reservation_status" AS ENUM('RESERVED', 'CONSUMED', 'RELEASED');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('DRAFT', 'SENT', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."stock_adjustment_reason" AS ENUM('DAMAGE', 'SAMPLING', 'COUNT_CORRECTION', 'CUTTING_WASTE', 'RETURN', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."trim_unit" AS ENUM('PIECE', 'METRE', 'SPOOL');--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"contact_name" text,
	"phone" text,
	"email" text,
	"address" text,
	"payment_terms" text,
	"lead_time_days" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN IF NOT EXISTS "reorder_point_meters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN IF NOT EXISTS "reorder_quantity_meters" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "fabrics" ADD COLUMN IF NOT EXISTS "default_supplier_id" uuid;--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" uuid PRIMARY KEY NOT NULL,
	"po_number" text NOT NULL,
	"supplier_id" uuid NOT NULL,
	"status" "purchase_order_status" DEFAULT 'DRAFT' NOT NULL,
	"ordered_at" timestamp with time zone,
	"expected_at" timestamp with time zone,
	"received_at" timestamp with time zone,
	"total_minor" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_po_number_unique" UNIQUE("po_number")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"fabric_id" uuid NOT NULL,
	"meters_ordered" integer NOT NULL,
	"meters_received" integer DEFAULT 0 NOT NULL,
	"unit_cost_minor" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fabric_lots" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fabric_id" uuid NOT NULL,
	"lot_code" text NOT NULL,
	"dye_lot_ref" text,
	"meters_received" integer NOT NULL,
	"meters_on_hand" integer NOT NULL,
	"meters_reserved" integer DEFAULT 0 NOT NULL,
	"cost_per_meter_minor" integer DEFAULT 0 NOT NULL,
	"supplier_id" uuid,
	"purchase_order_id" uuid,
	"received_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"colour_notes" text,
	"swatch_asset_id" uuid,
	"status" "fabric_lot_status" DEFAULT 'AVAILABLE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fabric_reservations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"order_item_id" uuid NOT NULL,
	"fabric_lot_id" uuid NOT NULL,
	"meters_reserved" integer NOT NULL,
	"status" "fabric_reservation_status" DEFAULT 'RESERVED' NOT NULL,
	"reserved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	"released_at" timestamp with time zone,
	"actual_meters_consumed" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"fabric_lot_id" uuid NOT NULL,
	"delta_meters" integer NOT NULL,
	"reason" "stock_adjustment_reason" NOT NULL,
	"note" text,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trims" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"unit" "trim_unit" NOT NULL,
	"quantity_on_hand" integer DEFAULT 0 NOT NULL,
	"quantity_reserved" integer DEFAULT 0 NOT NULL,
	"reorder_point" integer DEFAULT 0 NOT NULL,
	"cost_per_unit_minor" integer DEFAULT 0 NOT NULL,
	"supplier_id" uuid,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fabrics" ADD CONSTRAINT "fabrics_default_supplier_id_suppliers_id_fk" FOREIGN KEY ("default_supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_fabric_id_fabrics_id_fk" FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_swatch_asset_id_assets_id_fk" FOREIGN KEY ("swatch_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_reservations" ADD CONSTRAINT "fabric_reservations_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fabric_reservations" ADD CONSTRAINT "fabric_reservations_fabric_lot_id_fabric_lots_id_fk" FOREIGN KEY ("fabric_lot_id") REFERENCES "public"."fabric_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_fabric_lot_id_fabric_lots_id_fk" FOREIGN KEY ("fabric_lot_id") REFERENCES "public"."fabric_lots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trims" ADD CONSTRAINT "trims_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "fabric_lots_fabric_lot_code_uidx" ON "fabric_lots" USING btree ("fabric_id","lot_code");
