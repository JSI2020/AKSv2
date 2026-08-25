-- Inventory stock ledger layer

DO $$ BEGIN
  CREATE TYPE "public"."trim_kind" AS ENUM('BUTTON','ZIP','LINING','HOOK','THREAD','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."inventory_movement_reason" AS ENUM('RECEIVED','SOLD_OFFLINE','DAMAGE','COUNT_CORRECTION','ORDER_DISPATCH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "fabric_colourways" (
  "id" uuid PRIMARY KEY NOT NULL,
  "fabric_id" uuid NOT NULL,
  "colour_name" text NOT NULL,
  "hex_approximation" text,
  "swatch_asset_id" uuid,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "fabric_colourways" ADD CONSTRAINT "fabric_colourways_fabric_id_fabrics_id_fk"
    FOREIGN KEY ("fabric_id") REFERENCES "public"."fabrics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "fabric_colourways" ADD CONSTRAINT "fabric_colourways_swatch_asset_id_assets_id_fk"
    FOREIGN KEY ("swatch_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "fabric_colourways_fabric_name_uidx"
  ON "fabric_colourways" USING btree ("fabric_id","colour_name");

ALTER TABLE "fabric_lots" ADD COLUMN IF NOT EXISTS "colourway_id" uuid;

DO $$ BEGIN
  ALTER TABLE "fabric_lots" ADD CONSTRAINT "fabric_lots_colourway_id_fabric_colourways_id_fk"
    FOREIGN KEY ("colourway_id") REFERENCES "public"."fabric_colourways"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "rtw_stock" (
  "id" uuid PRIMARY KEY NOT NULL,
  "design_id" uuid NOT NULL,
  "colourway_id" uuid NOT NULL,
  "size_label" text NOT NULL,
  "quantity_on_hand" integer DEFAULT 0 NOT NULL,
  "quantity_reserved" integer DEFAULT 0 NOT NULL,
  "reorder_point" integer DEFAULT 2 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "rtw_stock" ADD CONSTRAINT "rtw_stock_design_id_designs_id_fk"
    FOREIGN KEY ("design_id") REFERENCES "public"."designs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rtw_stock" ADD CONSTRAINT "rtw_stock_colourway_id_colourways_id_fk"
    FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "rtw_stock_design_cw_size_uidx"
  ON "rtw_stock" USING btree ("design_id","colourway_id","size_label");

CREATE TABLE IF NOT EXISTS "rtw_movements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "rtw_stock_id" uuid NOT NULL,
  "delta" integer NOT NULL,
  "reason" "public"."inventory_movement_reason" NOT NULL,
  "order_id" uuid,
  "note" text,
  "actor_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "rtw_movements" ADD CONSTRAINT "rtw_movements_rtw_stock_id_rtw_stock_id_fk"
    FOREIGN KEY ("rtw_stock_id") REFERENCES "public"."rtw_stock"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rtw_movements" ADD CONSTRAINT "rtw_movements_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "rtw_movements" ADD CONSTRAINT "rtw_movements_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "packing_materials" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "photo_asset_id" uuid,
  "quantity_on_hand" integer DEFAULT 0 NOT NULL,
  "quantity_reserved" integer DEFAULT 0 NOT NULL,
  "reorder_point" integer DEFAULT 0 NOT NULL,
  "cost_per_unit_minor" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "packing_materials" ADD CONSTRAINT "packing_materials_photo_asset_id_assets_id_fk"
    FOREIGN KEY ("photo_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "packing_movements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "packing_material_id" uuid NOT NULL,
  "delta" integer NOT NULL,
  "reason" "public"."inventory_movement_reason" NOT NULL,
  "order_id" uuid,
  "note" text,
  "actor_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "packing_movements" ADD CONSTRAINT "packing_movements_packing_material_id_packing_materials_id_fk"
    FOREIGN KEY ("packing_material_id") REFERENCES "public"."packing_materials"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "packing_movements" ADD CONSTRAINT "packing_movements_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "packing_movements" ADD CONSTRAINT "packing_movements_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "trims" ADD COLUMN IF NOT EXISTS "kind" "public"."trim_kind" DEFAULT 'OTHER' NOT NULL;
ALTER TABLE "trims" ADD COLUMN IF NOT EXISTS "has_colour_variants" boolean DEFAULT false NOT NULL;
ALTER TABLE "trims" ADD COLUMN IF NOT EXISTS "photo_asset_id" uuid;

DO $$ BEGIN
  ALTER TABLE "trims" ADD CONSTRAINT "trims_photo_asset_id_assets_id_fk"
    FOREIGN KEY ("photo_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "trim_colourways" (
  "id" uuid PRIMARY KEY NOT NULL,
  "trim_id" uuid NOT NULL,
  "colour_name" text NOT NULL,
  "hex_approximation" text,
  "swatch_asset_id" uuid,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "trim_colourways" ADD CONSTRAINT "trim_colourways_trim_id_trims_id_fk"
    FOREIGN KEY ("trim_id") REFERENCES "public"."trims"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trim_colourways" ADD CONSTRAINT "trim_colourways_swatch_asset_id_assets_id_fk"
    FOREIGN KEY ("swatch_asset_id") REFERENCES "public"."assets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trim_colourways_trim_name_uidx"
  ON "trim_colourways" USING btree ("trim_id","colour_name");

CREATE TABLE IF NOT EXISTS "trim_stock" (
  "id" uuid PRIMARY KEY NOT NULL,
  "trim_id" uuid NOT NULL,
  "trim_colourway_id" uuid,
  "quantity_on_hand" integer DEFAULT 0 NOT NULL,
  "quantity_reserved" integer DEFAULT 0 NOT NULL,
  "reorder_point" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "trim_stock" ADD CONSTRAINT "trim_stock_trim_id_trims_id_fk"
    FOREIGN KEY ("trim_id") REFERENCES "public"."trims"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trim_stock" ADD CONSTRAINT "trim_stock_trim_colourway_id_trim_colourways_id_fk"
    FOREIGN KEY ("trim_colourway_id") REFERENCES "public"."trim_colourways"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "trim_stock_trim_cw_uidx"
  ON "trim_stock" USING btree ("trim_id","trim_colourway_id");

CREATE TABLE IF NOT EXISTS "trim_movements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "trim_stock_id" uuid NOT NULL,
  "delta" integer NOT NULL,
  "reason" "public"."inventory_movement_reason" NOT NULL,
  "order_id" uuid,
  "note" text,
  "actor_id" uuid,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "trim_movements" ADD CONSTRAINT "trim_movements_trim_stock_id_trim_stock_id_fk"
    FOREIGN KEY ("trim_stock_id") REFERENCES "public"."trim_stock"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trim_movements" ADD CONSTRAINT "trim_movements_order_id_orders_id_fk"
    FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "trim_movements" ADD CONSTRAINT "trim_movements_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
