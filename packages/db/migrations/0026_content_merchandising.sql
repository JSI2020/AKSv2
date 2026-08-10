-- Content / merchandising layer (admin → storefront)
CREATE TYPE "public"."homepage_status" AS ENUM('DRAFT', 'PUBLISHED');
CREATE TYPE "public"."content_page_status" AS ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "public"."featured_block_kind" AS ENUM('EDIT', 'LOOK', 'STATEMENT');
CREATE TYPE "public"."nav_area" AS ENUM('HEADER', 'FOOTER');
CREATE TYPE "public"."hero_text_position" AS ENUM('LEFT', 'CENTRE');

CREATE TABLE IF NOT EXISTS "site_settings" (
  "key" text PRIMARY KEY NOT NULL,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homepages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "status" "homepage_status" DEFAULT 'DRAFT' NOT NULL,
  "sections_order" jsonb DEFAULT '["hero","statement","categories","edit","fabric","atelier"]'::jsonb NOT NULL,
  "sections_enabled" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "homepage_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "entity_id" uuid NOT NULL,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "actor_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "hero_slides" (
  "id" uuid PRIMARY KEY NOT NULL,
  "homepage_id" uuid NOT NULL REFERENCES "homepages"("id") ON DELETE CASCADE,
  "desktop_image_asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL,
  "mobile_image_asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL,
  "video_asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL,
  "eyebrow" text DEFAULT '' NOT NULL,
  "headline" text DEFAULT '' NOT NULL,
  "subtext" text DEFAULT '' NOT NULL,
  "button_label" text DEFAULT '' NOT NULL,
  "button_link" jsonb DEFAULT '{"type":"hash","value":"#cats"}'::jsonb NOT NULL,
  "text_position" "hero_text_position" DEFAULT 'LEFT' NOT NULL,
  "overlay_strength" integer DEFAULT 40 NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "announcements" (
  "id" uuid PRIMARY KEY NOT NULL,
  "message" text NOT NULL,
  "link" jsonb,
  "active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "starts_at" timestamptz,
  "ends_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "category_tiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "homepage_id" uuid NOT NULL REFERENCES "homepages"("id") ON DELETE CASCADE,
  "category_key" text NOT NULL,
  "display_name" text NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "image_asset_id" uuid REFERENCES "assets"("id") ON DELETE SET NULL,
  "link" jsonb,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "featured_blocks" (
  "id" uuid PRIMARY KEY NOT NULL,
  "homepage_id" uuid NOT NULL REFERENCES "homepages"("id") ON DELETE CASCADE,
  "kind" "featured_block_kind" NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_pages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "slug" text NOT NULL,
  "title" text NOT NULL,
  "body" text DEFAULT '' NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "status" "content_page_status" DEFAULT 'DRAFT' NOT NULL,
  "published_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "content_pages_slug_uidx" ON "content_pages" ("slug");

CREATE TABLE IF NOT EXISTS "content_page_events" (
  "id" uuid PRIMARY KEY NOT NULL,
  "entity_id" uuid NOT NULL,
  "from_status" text NOT NULL,
  "to_status" text NOT NULL,
  "actor_id" uuid,
  "note" text,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "content_lists" (
  "id" uuid PRIMARY KEY NOT NULL,
  "key" text NOT NULL UNIQUE,
  "items" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "nav_items" (
  "id" uuid PRIMARY KEY NOT NULL,
  "area" "nav_area" NOT NULL,
  "column_key" text,
  "label" text NOT NULL,
  "link" jsonb DEFAULT '{"type":"none","value":""}'::jsonb NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "subtitle" text DEFAULT '' NOT NULL;
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "silhouette_label" text DEFAULT '' NOT NULL;
ALTER TABLE "designs" ADD COLUMN IF NOT EXISTS "model_info" text DEFAULT '' NOT NULL;
