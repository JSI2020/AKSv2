import {
  boolean,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { renderAngleEnum } from "./catalog";
import { users } from "./identity";
import { assets } from "./platform";
import { designs, colourways } from "./catalog";
import { houseModels } from "./fabrics-archetypes";

export const TRYON_SETTINGS_SINGLETON_ID =
  "01900000-0000-7000-8000-000000000002";

export const tryonSessionStatusEnum = pgEnum("tryon_session_status", [
  "PENDING",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "UNAVAILABLE",
]);

/** Singleton — Reflection quotas, model id, consent version. */
export const tryonSettings = pgTable("tryon_settings", {
  id: uuid("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  /** Verified fal endpoint — default easel-ai/advanced-face-swap. */
  modelId: text("model_id").notNull(),
  consentVersion: integer("consent_version").notNull().default(1),
  anonDailyLimit: integer("anon_daily_limit").notNull().default(3),
  signedInDailyLimit: integer("signed_in_daily_limit").notNull().default(20),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Versioned, unbundled consent — never merged into terms. */
export const tryonConsents = pgTable("tryon_consents", {
  id: uuid("id").primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonId: text("anon_id"),
  version: integer("version").notNull(),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const uploadedSelfies = pgTable("uploaded_selfies", {
  id: uuid("id").primaryKey(),
  consentId: uuid("consent_id")
    .notNull()
    .references(() => tryonConsents.id, { onDelete: "cascade" }),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  /** SHA-256 of normalized face region — cache key component. */
  faceEmbeddingRef: text("face_embedding_ref"),
  purgeAt: timestamp("purge_at", { withTimezone: true }).notNull(),
  purgedAt: timestamp("purged_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tryonSessions = pgTable("tryon_sessions", {
  id: uuid("id").primaryKey(),
  consentId: uuid("consent_id")
    .notNull()
    .references(() => tryonConsents.id),
  selfieId: uuid("selfie_id")
    .notNull()
    .references(() => uploadedSelfies.id),
  designId: uuid("design_id")
    .notNull()
    .references(() => designs.id, { onDelete: "cascade" }),
  colourwayId: uuid("colourway_id")
    .notNull()
    .references(() => colourways.id),
  archetypeId: uuid("archetype_id").references(() => houseModels.id),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  anonId: text("anon_id"),
  status: tryonSessionStatusEnum("status").notNull().default("PENDING"),
  faceCacheKey: text("face_cache_key").notNull(),
  addedToCartAt: timestamp("added_to_cart_at", { withTimezone: true }),
  /** USD micro-dollars for non-cached generations this session. */
  costUsdMicros: integer("cost_usd_micros"),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const tryonResults = pgTable("tryon_results", {
  id: uuid("id").primaryKey(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => tryonSessions.id, { onDelete: "cascade" }),
  angle: renderAngleEnum("angle").notNull(),
  assetId: uuid("asset_id")
    .notNull()
    .references(() => assets.id),
  /** hash(faceEmbedding)+designId+colourwayId+archetypeId */
  cacheKey: text("cache_key").notNull(),
  costUsdMicros: integer("cost_usd_micros").notNull().default(0),
  fromCache: boolean("from_cache").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
