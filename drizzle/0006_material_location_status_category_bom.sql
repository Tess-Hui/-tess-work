DO $$ BEGIN
  CREATE TYPE "material_location_status" AS ENUM ('active', 'used_up', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE IF EXISTS "materials"
  ADD COLUMN IF NOT EXISTS "category" text NOT NULL DEFAULT '未分类';

UPDATE "materials"
SET "category" = CASE
  WHEN "name" ILIKE '%彩盒%' THEN '彩盒'
  WHEN "name" ILIKE '%贺卡%' THEN '贺卡'
  WHEN "name" ILIKE '%标签%' THEN '标签类'
  ELSE COALESCE(NULLIF("category", ''), '未分类')
END
WHERE "category" = '未分类' OR "category" = '';

CREATE INDEX IF NOT EXISTS "materials_category_idx" ON "materials" ("category");

CREATE TABLE IF NOT EXISTS "material_location_states" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "material_id" uuid NOT NULL REFERENCES "materials"("id"),
  "location_id" uuid NOT NULL REFERENCES "locations"("id"),
  "status" "material_location_status" NOT NULL DEFAULT 'active',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_location_states_unique_idx"
  ON "material_location_states" ("material_id", "location_id");
CREATE INDEX IF NOT EXISTS "material_location_states_material_idx"
  ON "material_location_states" ("material_id");
CREATE INDEX IF NOT EXISTS "material_location_states_location_idx"
  ON "material_location_states" ("location_id");
CREATE INDEX IF NOT EXISTS "material_location_states_status_idx"
  ON "material_location_states" ("status");

CREATE TABLE IF NOT EXISTS "bom_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "parent_material_id" uuid NOT NULL REFERENCES "materials"("id"),
  "child_material_id" uuid NOT NULL REFERENCES "materials"("id"),
  "quantity" numeric(12, 2) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "bom_items_parent_child_idx"
  ON "bom_items" ("parent_material_id", "child_material_id");
CREATE INDEX IF NOT EXISTS "bom_items_parent_idx" ON "bom_items" ("parent_material_id");
CREATE INDEX IF NOT EXISTS "bom_items_child_idx" ON "bom_items" ("child_material_id");
