ALTER TABLE IF EXISTS "movements" ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);
ALTER TABLE IF EXISTS "batches" ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);
UPDATE "batches"
SET "total_price" = COALESCE("total_price", "price" * "quantity")
WHERE "total_price" IS NULL;
