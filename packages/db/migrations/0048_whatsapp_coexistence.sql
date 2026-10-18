CREATE TABLE IF NOT EXISTS "whatsapp_connections" (
  "id" uuid PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'PENDING' NOT NULL,
  "app_id" text NOT NULL,
  "config_id" text,
  "waba_id" text,
  "phone_number_id" text,
  "display_phone_number" text,
  "verified_name" text,
  "business_token_encrypted" text,
  "contacts_sync" text DEFAULT 'not_started' NOT NULL,
  "history_sync" text DEFAULT 'not_started' NOT NULL,
  "contacts_sync_detail" text,
  "history_sync_detail" text,
  "contacts_received" integer DEFAULT 0 NOT NULL,
  "history_messages_received" integer DEFAULT 0 NOT NULL,
  "last_error" text,
  "connected_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "whatsapp_synced_contacts" (
  "id" uuid PRIMARY KEY NOT NULL,
  "connection_id" uuid NOT NULL,
  "wa_id" text NOT NULL,
  "full_name" text,
  "action" text DEFAULT 'add' NOT NULL,
  "synced_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "whatsapp_synced_contacts"
    ADD CONSTRAINT "whatsapp_synced_contacts_connection_id_whatsapp_connections_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "public"."whatsapp_connections"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "whatsapp_synced_contacts_connection_wa_uidx"
  ON "whatsapp_synced_contacts" USING btree ("connection_id","wa_id");
