-- Customer CRM soft-merge fields

ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "merged_into_user_id" uuid;
ALTER TABLE "customer_profiles" ADD COLUMN IF NOT EXISTS "merged_at" timestamptz;

DO $$ BEGIN
  ALTER TABLE "customer_profiles" ADD CONSTRAINT "customer_profiles_merged_into_user_id_users_id_fk"
    FOREIGN KEY ("merged_into_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "customer_profiles_merged_into_idx"
  ON "customer_profiles" USING btree ("merged_into_user_id");
