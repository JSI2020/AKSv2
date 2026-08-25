import { sql } from "drizzle-orm";
import {
  boolean, doublePrecision, integer, jsonb, pgEnum, pgTable, primaryKey,
  text, timestamp, uniqueIndex, uuid,
} from "drizzle-orm/pg-core";

export const dressStandardSizeEnum = pgEnum("dress_standard_size", ["XS", "S", "M", "L", "XL", "XXL"]);
export const dressBodyDimensionEnum = pgEnum("dress_body_dimension", ["bust", "waist", "hip", "shoulder", "height"]);
export const dressFitWeightDimensionEnum = pgEnum("dress_fit_weight_dimension", ["bust", "waist", "hip", "height"]);
export const dressGarmentTypeEnum = pgEnum("dress_garment_type", ["short_shirt", "long_gown", "kurti", "vest_palazzo", "trouser"]);
export const dressStyleCategoryEnum = pgEnum("dress_style_category", ["essentials", "modern_tailored", "occasion", "signature", "separates"]);
export const dressPomKeyEnum = pgEnum("dress_pom_key", ["chest", "waist", "hip", "shoulder", "sleeveLength", "garmentLength", "hemWidth", "neckDrop"]);
export const dressPomKindEnum = pgEnum("dress_pom_kind", ["girth", "design"]);
export const dressLengthBandEnum = pgEnum("dress_length_band", ["above_knee", "knee", "below_knee", "ankle", "floor"]);
export const dressFitIntentEnum = pgEnum("dress_fit_intent", ["fitted", "semi_fitted", "relaxed", "oversized"]);
export const dressStyleStatusEnum = pgEnum("dress_style_status", ["draft", "published"]);
export const dressRecognitionStatusEnum = pgEnum("dress_recognition_status", ["proposed", "confirmed", "rejected"]);
export const dressFitOutcomeEnum = pgEnum("dress_fit_outcome", ["kept", "returned", "exchanged"]);
export const dressFitReasonEnum = pgEnum("dress_fit_reason", ["too_tight", "too_loose", "too_short", "too_long", "other"]);

const createdAt = timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
/** Integer hundredths of an inch. */
const hundredths = (name: string) => integer(name);

export const dressSizeGrid = pgTable("dress_size_grid", {
  id: uuid("id").primaryKey(), name: text("name").notNull(),
  isActive: boolean("is_active").notNull().default(false),
}, (t) => [uniqueIndex("dress_size_grid_one_active_uidx").on(t.isActive).where(sql`${t.isActive} = true`)]);

export const dressSizeGridRow = pgTable("dress_size_grid_row", {
  id: uuid("id").primaryKey(),
  gridId: uuid("grid_id").notNull().references(() => dressSizeGrid.id, { onDelete: "cascade" }),
  size: dressStandardSizeEnum("size").notNull(),
  /** Hundredths of an inch. */ bust: hundredths("bust").notNull(),
  /** Hundredths of an inch. */ waist: hundredths("waist").notNull(),
  /** Hundredths of an inch. */ hip: hundredths("hip").notNull(),
  /** Hundredths of an inch. */ shoulder: hundredths("shoulder").notNull(),
  /** Hundredths of an inch. */ height: hundredths("height").notNull(),
}, (t) => [uniqueIndex("dress_size_grid_row_grid_size_uidx").on(t.gridId, t.size)]);

export const dressStyleTemplate = pgTable("dress_style_template", {
  id: uuid("id").primaryKey(), key: dressGarmentTypeEnum("key").notNull(),
  category: dressStyleCategoryEnum("category").notNull(),
  baseSize: dressStandardSizeEnum("base_size").notNull().default("M"),
}, (t) => [uniqueIndex("dress_style_template_key_uidx").on(t.key)]);

export const dressStyleTemplatePom = pgTable("dress_style_template_pom", {
  id: uuid("id").primaryKey(),
  templateId: uuid("template_id").notNull().references(() => dressStyleTemplate.id, { onDelete: "cascade" }),
  key: dressPomKeyEnum("key").notNull(), kind: dressPomKindEnum("kind").notNull(),
  derivedFrom: dressBodyDimensionEnum("derived_from"),
  ease: hundredths("ease"), baseValue: hundredths("base_value"),
  gradeIncrement: hundredths("grade_increment").notNull().default(0),
}, (t) => [uniqueIndex("dress_style_template_pom_template_key_uidx").on(t.templateId, t.key)]);

export const dressStyleTemplateFitWeight = pgTable("dress_style_template_fit_weight", {
  id: uuid("id").primaryKey(),
  templateId: uuid("template_id").notNull().references(() => dressStyleTemplate.id, { onDelete: "cascade" }),
  dimension: dressFitWeightDimensionEnum("dimension").notNull(), weight: integer("weight").notNull(),
}, (t) => [uniqueIndex("dress_style_template_fit_weight_uidx").on(t.templateId, t.dimension)]);

export const dressStyle = pgTable("dress_style", {
  id: uuid("id").primaryKey(), name: text("name").notNull(),
  templateId: uuid("template_id").references(() => dressStyleTemplate.id, { onDelete: "set null" }),
  category: dressStyleCategoryEnum("category").notNull(),
  baseSize: dressStandardSizeEnum("base_size").notNull().default("M"),
  lengthBand: dressLengthBandEnum("length_band").notNull(),
  fitIntent: dressFitIntentEnum("fit_intent").notNull(),
  sourceImageUrl: text("source_image_url"),
  recognitionConfidence: doublePrecision("recognition_confidence"),
  status: dressStyleStatusEnum("status").notNull().default("draft"),
});

export const dressStylePom = pgTable("dress_style_pom", {
  id: uuid("id").primaryKey(),
  styleId: uuid("style_id").notNull().references(() => dressStyle.id, { onDelete: "cascade" }),
  key: dressPomKeyEnum("key").notNull(), kind: dressPomKindEnum("kind").notNull(),
  derivedFrom: dressBodyDimensionEnum("derived_from"),
  ease: hundredths("ease"), baseValue: hundredths("base_value"),
  gradeIncrement: hundredths("grade_increment").notNull().default(0),
}, (t) => [uniqueIndex("dress_style_pom_style_key_uidx").on(t.styleId, t.key)]);

export const dressStyleFitWeight = pgTable("dress_style_fit_weight", {
  id: uuid("id").primaryKey(),
  styleId: uuid("style_id").notNull().references(() => dressStyle.id, { onDelete: "cascade" }),
  dimension: dressFitWeightDimensionEnum("dimension").notNull(), weight: integer("weight").notNull(),
}, (t) => [uniqueIndex("dress_style_fit_weight_uidx").on(t.styleId, t.dimension)]);

export const dressRecognitionProposal = pgTable("dress_recognition_proposal", {
  id: uuid("id").primaryKey(), imageUrl: text("image_url").notNull(),
  templateKey: dressGarmentTypeEnum("template_key").notNull(),
  lengthBand: dressLengthBandEnum("length_band").notNull(),
  fitIntent: dressFitIntentEnum("fit_intent").notNull(),
  confidence: doublePrecision("confidence").notNull(),
  rawJson: jsonb("raw_json").$type<Record<string, unknown>>().notNull(),
  status: dressRecognitionStatusEnum("status").notNull().default("proposed"), createdAt,
});

export const dressGeneratedChart = pgTable("dress_generated_chart", {
  styleId: uuid("style_id").notNull().references(() => dressStyle.id, { onDelete: "cascade" }),
  size: dressStandardSizeEnum("size").notNull(), pomKey: dressPomKeyEnum("pom_key").notNull(),
  /** Hundredths of an inch. */ valueHundredths: hundredths("value_hundredths").notNull(),
}, (t) => [primaryKey({ columns: [t.styleId, t.size, t.pomKey], name: "dress_generated_chart_pk" })]);

export const dressFitEvent = pgTable("dress_fit_event", {
  id: uuid("id").primaryKey(),
  styleId: uuid("style_id").notNull().references(() => dressStyle.id, { onDelete: "cascade" }),
  size: dressStandardSizeEnum("size").notNull(), outcome: dressFitOutcomeEnum("outcome").notNull(),
  reason: dressFitReasonEnum("reason").notNull(), createdAt,
});
