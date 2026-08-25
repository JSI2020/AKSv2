-- Backfill order_status after 0015 committed new enum labels.
-- Idempotent: no-op when no IN_PRODUCTION rows remain.

UPDATE "orders" SET "status" = 'CUTTING' WHERE "status" = 'IN_PRODUCTION';
