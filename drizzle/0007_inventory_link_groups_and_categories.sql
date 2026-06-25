CREATE TABLE IF NOT EXISTS "material_categories" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "material_categories_name_idx" ON "material_categories" USING btree ("name");
CREATE INDEX IF NOT EXISTS "material_categories_sort_idx" ON "material_categories" USING btree ("sort_order");

INSERT INTO "material_categories" ("name", "sort_order")
VALUES
  ('贺卡', 10),
  ('彩盒', 20),
  ('标签类', 30),
  ('说明书', 40),
  ('贴纸', 50),
  ('包装袋', 60),
  ('配件', 70),
  ('其他', 90),
  ('未分类', 100)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "material_categories" ("name", "sort_order")
SELECT DISTINCT "category", 80
FROM "materials"
WHERE COALESCE(NULLIF("category", ''), '') <> ''
ON CONFLICT ("name") DO NOTHING;

CREATE TABLE IF NOT EXISTS "inventory_link_groups" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "scope" text DEFAULT 'material' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "inventory_link_group_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL REFERENCES "inventory_link_groups"("id"),
  "target_type" text DEFAULT 'material' NOT NULL,
  "material_id" uuid REFERENCES "materials"("id"),
  "batch_id" uuid REFERENCES "batches"("id"),
  "sort_order" integer DEFAULT 0 NOT NULL,
  "default_enabled" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "inventory_link_groups_scope_idx" ON "inventory_link_groups" USING btree ("scope");
CREATE INDEX IF NOT EXISTS "inventory_link_groups_created_at_idx" ON "inventory_link_groups" USING btree ("created_at");
CREATE INDEX IF NOT EXISTS "inventory_link_group_items_group_idx" ON "inventory_link_group_items" USING btree ("group_id");
CREATE INDEX IF NOT EXISTS "inventory_link_group_items_material_idx" ON "inventory_link_group_items" USING btree ("material_id");
CREATE INDEX IF NOT EXISTS "inventory_link_group_items_batch_idx" ON "inventory_link_group_items" USING btree ("batch_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_material_idx" ON "inventory_link_group_items" USING btree ("group_id", "material_id");
CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_batch_idx" ON "inventory_link_group_items" USING btree ("group_id", "batch_id");
