import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { designs } from "./catalog";
import { assets } from "./platform";
import { createEntityEventsTable } from "./events";

/** Picker target stored on buttons, nav, announcements, tiles. */
export type ContentLink = {
  type: "collection" | "design" | "page" | "url" | "hash" | "none";
  value: string;
};

export const homepageStatusEnum = pgEnum("homepage_status", [
  "DRAFT",
  "PUBLISHED",
]);

export const contentPageStatusEnum = pgEnum("content_page_status", [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
]);

export const featuredBlockKindEnum = pgEnum("featured_block_kind", [
  "EDIT",
  "LOOK",
  "STATEMENT",
]);

export const navAreaEnum = pgEnum("nav_area", ["HEADER", "FOOTER"]);

export const heroTextPositionEnum = pgEnum("hero_text_position", [
  "LEFT",
  "CENTRE",
]);

/** Key/value storefront globals — lead time copy, WhatsApp, socials, brand… */
export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<unknown>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * One draft + one published homepage config.
 * Storefront always reads status = PUBLISHED (or draft for preview).
 */
export const homepages = pgTable("homepages", {
  id: uuid("id").primaryKey(),
  status: homepageStatusEnum("status").notNull().default("DRAFT"),
  /** Ordered block keys: hero, statement, categories, edit, fabric, atelier… */
  sectionsOrder: jsonb("sections_order")
    .$type<string[]>()
    .notNull()
    .default([
      "hero",
      "statement",
      "categories",
      "edit",
      "fabric",
      "atelier",
    ]),
  /** Per-section on/off. Missing key = on. */
  sectionsEnabled: jsonb("sections_enabled")
    .$type<Record<string, boolean>>()
    .notNull()
    .default({}),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const homepageEvents = createEntityEventsTable("homepage_events");

export const heroSlides = pgTable("hero_slides", {
  id: uuid("id").primaryKey(),
  homepageId: uuid("homepage_id")
    .notNull()
    .references(() => homepages.id, { onDelete: "cascade" }),
  desktopImageAssetId: uuid("desktop_image_asset_id").references(
    () => assets.id,
    { onDelete: "set null" },
  ),
  mobileImageAssetId: uuid("mobile_image_asset_id").references(
    () => assets.id,
    { onDelete: "set null" },
  ),
  videoAssetId: uuid("video_asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  /** When set, slide photo + PDP link come from this published design. */
  linkedDesignId: uuid("linked_design_id").references(() => designs.id, {
    onDelete: "set null",
  }),
  eyebrow: text("eyebrow").notNull().default(""),
  headline: text("headline").notNull().default(""),
  subtext: text("subtext").notNull().default(""),
  buttonLabel: text("button_label").notNull().default(""),
  buttonLink: jsonb("button_link")
    .$type<ContentLink>()
    .notNull()
    .default({ type: "hash", value: "#cats" }),
  textPosition: heroTextPositionEnum("text_position")
    .notNull()
    .default("LEFT"),
  /** 0–100 overlay darkness for text legibility. */
  overlayStrength: integer("overlay_strength").notNull().default(40),
  sortOrder: integer("sort_order").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey(),
  message: text("message").notNull(),
  link: jsonb("link").$type<ContentLink | null>(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const categoryTiles = pgTable("category_tiles", {
  id: uuid("id").primaryKey(),
  homepageId: uuid("homepage_id")
    .notNull()
    .references(() => homepages.id, { onDelete: "cascade" }),
  /** House collection slug (essentials, tailored, …) or free key. */
  categoryKey: text("category_key").notNull(),
  displayName: text("display_name").notNull(),
  caption: text("caption").notNull().default(""),
  imageAssetId: uuid("image_asset_id").references(() => assets.id, {
    onDelete: "set null",
  }),
  link: jsonb("link").$type<ContentLink | null>(),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const featuredBlocks = pgTable("featured_blocks", {
  id: uuid("id").primaryKey(),
  homepageId: uuid("homepage_id")
    .notNull()
    .references(() => homepages.id, { onDelete: "cascade" }),
  kind: featuredBlockKindEnum("kind").notNull(),
  /** EDIT: { mode, designIds? }; LOOK: { designId, story }; STATEMENT: { text } */
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const contentPages = pgTable(
  "content_pages",
  {
    id: uuid("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    version: integer("version").notNull().default(1),
    status: contentPageStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("content_pages_slug_uidx").on(t.slug)],
);

export const contentPageEvents = createEntityEventsTable("content_page_events");

/** Reorderable lists: CONSTRUCTION, FAQ, … */
export const contentLists = pgTable("content_lists", {
  id: uuid("id").primaryKey(),
  key: text("key").notNull().unique(),
  items: jsonb("items")
    .$type<Array<{ id: string; icon?: string; text: string; answer?: string }>>()
    .notNull()
    .default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const navItems = pgTable("nav_items", {
  id: uuid("id").primaryKey(),
  area: navAreaEnum("area").notNull(),
  /** Footer column key when area = FOOTER: brand | shop | atelier | stay */
  columnKey: text("column_key"),
  label: text("label").notNull(),
  link: jsonb("link")
    .$type<ContentLink>()
    .notNull()
    .default({ type: "none", value: "" }),
  sortOrder: integer("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
