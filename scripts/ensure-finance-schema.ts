import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url, { max: 1 });
  await sql.unsafe(`
DO $$ BEGIN
  CREATE TYPE "public"."expenditure_category" AS ENUM(
    'RENT','SALARIES','MARKETING','UTILITIES','SOFTWARE','EQUIPMENT','MATERIALS','TAXES','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."expenditure_payment_method" AS ENUM(
    'CASH','BANK_TRANSFER','CARD'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."expenditure_recurrence" AS ENUM('MONTHLY','YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "expenditures" (
  "id" uuid PRIMARY KEY NOT NULL,
  "date" timestamp with time zone NOT NULL,
  "category" "expenditure_category" NOT NULL,
  "payee" text NOT NULL,
  "amount_minor" integer NOT NULL,
  "payment_method" "expenditure_payment_method" NOT NULL,
  "is_recurring" boolean DEFAULT false NOT NULL,
  "recurrence_cycle" "expenditure_recurrence",
  "ended_at" timestamp with time zone,
  "note" text,
  "receipt_asset_id" uuid,
  "actor_id" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "expenditures" ADD CONSTRAINT "expenditures_actor_id_users_id_fk"
    FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "expenditures_date_idx" ON "expenditures" ("date");
CREATE INDEX IF NOT EXISTS "expenditures_category_idx" ON "expenditures" ("category");

INSERT INTO "expenditures" (
  "id", "date", "category", "payee", "amount_minor", "payment_method",
  "is_recurring", "recurrence_cycle", "ended_at", "note", "created_at"
)
SELECT
  gen_random_uuid(),
  rc."started_at",
  'OTHER'::"expenditure_category",
  rc."name",
  CASE rc."cycle"
    WHEN 'WEEKLY' THEN round(rc."amount_minor" * 52 / 12)::integer
    WHEN 'QUARTERLY' THEN round(rc."amount_minor" / 3)::integer
    WHEN 'YEARLY' THEN round(rc."amount_minor" / 12)::integer
    ELSE rc."amount_minor"
  END,
  'BANK_TRANSFER'::"expenditure_payment_method",
  true,
  CASE WHEN rc."cycle" = 'YEARLY' THEN 'YEARLY'::"expenditure_recurrence"
       ELSE 'MONTHLY'::"expenditure_recurrence"
  END,
  rc."ended_at",
  'Migrated from recurring_costs (' || rc."category" || ')',
  now()
FROM "recurring_costs" rc
WHERE rc."active" = true
  AND NOT EXISTS (
    SELECT 1 FROM "expenditures" e
    WHERE e."payee" = rc."name"
      AND e."is_recurring" = true
      AND e."note" LIKE 'Migrated from recurring_costs%'
  );

ALTER TABLE "cod_remittances"
  ADD COLUMN IF NOT EXISTS "per_order_expected" jsonb DEFAULT '{}'::jsonb NOT NULL;
`);
  await sql.end({ timeout: 5 });
  console.log("finance expenditures schema ensured");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
