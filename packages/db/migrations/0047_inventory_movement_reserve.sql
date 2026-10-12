ALTER TYPE "public"."inventory_movement_reason" ADD VALUE IF NOT EXISTS 'RESERVED';--> statement-breakpoint
ALTER TYPE "public"."inventory_movement_reason" ADD VALUE IF NOT EXISTS 'RELEASED';
