CREATE TABLE IF NOT EXISTS "house_collections" (
  "id" uuid PRIMARY KEY NOT NULL,
  "tag" text NOT NULL,
  "slug" text NOT NULL,
  "item_code" text NOT NULL,
  "nav_label" text NOT NULL,
  "title" text NOT NULL,
  "tagline" text NOT NULL DEFAULT '',
  "card" text NOT NULL DEFAULT '',
  "intro" text NOT NULL DEFAULT '',
  "sort_order" integer NOT NULL DEFAULT 0,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "house_collections_tag_uidx" ON "house_collections" ("tag");
CREATE UNIQUE INDEX IF NOT EXISTS "house_collections_slug_uidx" ON "house_collections" ("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "house_collections_item_code_uidx" ON "house_collections" ("item_code");
