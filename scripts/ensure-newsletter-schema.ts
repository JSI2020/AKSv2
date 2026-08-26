import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local" });
config({ path: ".env" });

/**
 * Idempotent schema-ensure for the storefront newsletter list. Mirrors the
 * other `db:ensure:*` scripts — safe to run repeatedly on the live DB whose
 * migration snapshots have drifted.
 */
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const sql = postgres(url, { max: 1 });
  await sql.unsafe(`
CREATE TABLE IF NOT EXISTS "newsletter_subscribers" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "locale" text,
  "source" text DEFAULT 'footer' NOT NULL,
  "user_id" uuid,
  "unsubscribed_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "newsletter_subscribers_email_unique" UNIQUE("email")
);

DO $$ BEGIN
  ALTER TABLE "newsletter_subscribers" ADD CONSTRAINT "newsletter_subscribers_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
`);
  await sql.end({ timeout: 5 });
  console.log("newsletter schema ensured");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
