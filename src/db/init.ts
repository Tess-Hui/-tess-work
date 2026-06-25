import { neon } from "@neondatabase/serverless";

declare global {
  var __tessDatabaseInitPromise: Promise<void> | undefined;
  var __tessDatabaseCompatPromise: Promise<void> | undefined;
  var __tessDatabaseInitSkipLogged: boolean | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Configure Neon Postgres before using the app.");
  }

  return databaseUrl;
}

async function runDatabaseInit() {
  console.log("database:init start");
  const sql = neon(getDatabaseUrl());

  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."priority" AS ENUM ('high', 'medium', 'low');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."task_status" AS ENUM ('todo', 'completed', 'trashed');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."batch_status" AS ENUM ('active', 'used_up', 'inactive');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."material_location_status" AS ENUM ('active', 'used_up', 'inactive');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."location_type" AS ENUM ('warehouse', 'factory', 'other');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."movement_type" AS ENUM ('OUT', 'TRANSFER', 'RETURN', 'SCRAP', 'CONSUME');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    ALTER TYPE "public"."movement_type" ADD VALUE IF NOT EXISTS 'STOCK_IN';
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "tasks" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "content" text NOT NULL,
      "planned_at" timestamp with time zone,
      "completed_at" timestamp with time zone,
      "liaison" text DEFAULT '' NOT NULL,
      "priority" "priority" DEFAULT 'medium' NOT NULL,
      "status" "task_status" DEFAULT 'todo' NOT NULL,
      "notes" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
      "trashed_at" timestamp with time zone
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "fixed_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "title" text NOT NULL,
      "content" text NOT NULL,
      "category" text DEFAULT 'General' NOT NULL,
      "priority" "priority" DEFAULT 'medium' NOT NULL,
      "pinned" boolean DEFAULT false NOT NULL,
      "show_on_dashboard" boolean DEFAULT true NOT NULL,
      "start_date" date,
      "end_date" date,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "reminders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "title" text NOT NULL,
      "content" text DEFAULT '' NOT NULL,
      "reminder_date" date NOT NULL,
      "reminder_time" text DEFAULT '' NOT NULL,
      "priority" "priority" DEFAULT 'medium' NOT NULL,
      "handled" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "memos" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "title" text NOT NULL,
      "content" text NOT NULL,
      "tags" text DEFAULT '' NOT NULL,
      "pinned" boolean DEFAULT false NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "materials" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "category" text DEFAULT '未分类' NOT NULL,
      "type" text DEFAULT '' NOT NULL,
      "size" text DEFAULT '' NOT NULL,
      "unit" text DEFAULT '' NOT NULL,
      "remark" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "material_sizes" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "remark" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "material_categories" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "sort_order" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "locations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "type" "location_type" DEFAULT 'warehouse' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "batches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "batch_code" text NOT NULL,
      "material_id" uuid NOT NULL REFERENCES "materials"("id"),
      "production_date" date NOT NULL,
      "quantity" numeric(12, 2) NOT NULL,
      "price" numeric(12, 2) NOT NULL,
      "total_price" numeric(12, 2) NOT NULL,
      "supplier" text DEFAULT '' NOT NULL,
      "manufacturer" text DEFAULT '' NOT NULL,
      "initial_location_id" uuid NOT NULL REFERENCES "locations"("id"),
      "status" "batch_status" DEFAULT 'active' NOT NULL,
      "remark" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "movements" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "batch_id" uuid NOT NULL REFERENCES "batches"("id"),
      "date" date NOT NULL,
      "type" "movement_type" NOT NULL,
      "from_location_id" uuid REFERENCES "locations"("id"),
      "to_location_id" uuid REFERENCES "locations"("id"),
      "quantity" numeric(12, 2) NOT NULL,
      "total_price" numeric(12, 2),
      "remark" text DEFAULT '' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    ALTER TABLE "movements" ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);
  `;

  await sql`
    ALTER TABLE IF EXISTS "materials"
    ADD COLUMN IF NOT EXISTS "category" text DEFAULT '未分类' NOT NULL;
  `;

  await sql`
    UPDATE "materials"
    SET "category" = CASE
      WHEN "name" ILIKE '%彩盒%' THEN '彩盒'
      WHEN "name" ILIKE '%贺卡%' THEN '贺卡'
      WHEN "name" ILIKE '%标签%' THEN '标签类'
      ELSE COALESCE(NULLIF("category", ''), '未分类')
    END
    WHERE "category" = '未分类' OR "category" = '';
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "material_location_states" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "material_id" uuid NOT NULL REFERENCES "materials"("id"),
      "location_id" uuid NOT NULL REFERENCES "locations"("id"),
      "status" "material_location_status" DEFAULT 'active' NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "bom_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "parent_material_id" uuid NOT NULL REFERENCES "materials"("id"),
      "child_material_id" uuid NOT NULL REFERENCES "materials"("id"),
      "quantity" numeric(12, 2) NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS "inventory_link_groups" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "name" text NOT NULL,
      "scope" text DEFAULT 'material' NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `;

  await sql`
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
  `;

  await sql`CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "tasks_priority_idx" ON "tasks" USING btree ("priority");`;
  await sql`CREATE INDEX IF NOT EXISTS "tasks_planned_at_idx" ON "tasks" USING btree ("planned_at");`;
  await sql`CREATE INDEX IF NOT EXISTS "fixed_items_category_idx" ON "fixed_items" USING btree ("category");`;
  await sql`CREATE INDEX IF NOT EXISTS "fixed_items_pinned_idx" ON "fixed_items" USING btree ("pinned");`;
  await sql`CREATE INDEX IF NOT EXISTS "reminders_date_idx" ON "reminders" USING btree ("reminder_date");`;
  await sql`CREATE INDEX IF NOT EXISTS "reminders_handled_idx" ON "reminders" USING btree ("handled");`;
  await sql`CREATE INDEX IF NOT EXISTS "memos_pinned_idx" ON "memos" USING btree ("pinned");`;
  await sql`CREATE INDEX IF NOT EXISTS "memos_tags_idx" ON "memos" USING btree ("tags");`;
  await sql`CREATE INDEX IF NOT EXISTS "materials_name_idx" ON "materials" USING btree ("name");`;
  await sql`CREATE INDEX IF NOT EXISTS "materials_category_idx" ON "materials" USING btree ("category");`;
  await sql`CREATE INDEX IF NOT EXISTS "materials_type_idx" ON "materials" USING btree ("type");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_sizes_name_idx" ON "material_sizes" USING btree ("name");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_categories_name_idx" ON "material_categories" USING btree ("name");`;
  await sql`CREATE INDEX IF NOT EXISTS "material_categories_sort_idx" ON "material_categories" USING btree ("sort_order");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "locations_name_idx" ON "locations" USING btree ("name");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "batches_code_idx" ON "batches" USING btree ("batch_code");`;
  await sql`CREATE INDEX IF NOT EXISTS "batches_material_idx" ON "batches" USING btree ("material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "batches_status_idx" ON "batches" USING btree ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "batches_production_date_idx" ON "batches" USING btree ("production_date");`;
  await sql`CREATE INDEX IF NOT EXISTS "batches_supplier_idx" ON "batches" USING btree ("supplier");`;
  await sql`CREATE INDEX IF NOT EXISTS "batches_manufacturer_idx" ON "batches" USING btree ("manufacturer");`;
  await sql`CREATE INDEX IF NOT EXISTS "movements_batch_idx" ON "movements" USING btree ("batch_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "movements_date_idx" ON "movements" USING btree ("date");`;
  await sql`CREATE INDEX IF NOT EXISTS "movements_type_idx" ON "movements" USING btree ("type");`;
  await sql`CREATE INDEX IF NOT EXISTS "movements_from_location_idx" ON "movements" USING btree ("from_location_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "movements_to_location_idx" ON "movements" USING btree ("to_location_id");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_location_states_unique_idx" ON "material_location_states" USING btree ("material_id", "location_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "material_location_states_material_idx" ON "material_location_states" USING btree ("material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "material_location_states_location_idx" ON "material_location_states" USING btree ("location_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "material_location_states_status_idx" ON "material_location_states" USING btree ("status");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "bom_items_parent_child_idx" ON "bom_items" USING btree ("parent_material_id", "child_material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "bom_items_parent_idx" ON "bom_items" USING btree ("parent_material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "bom_items_child_idx" ON "bom_items" USING btree ("child_material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "inventory_link_groups_scope_idx" ON "inventory_link_groups" USING btree ("scope");`;
  await sql`CREATE INDEX IF NOT EXISTS "inventory_link_groups_created_at_idx" ON "inventory_link_groups" USING btree ("created_at");`;
  await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_group_idx" ON "inventory_link_group_items" USING btree ("group_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_material_idx" ON "inventory_link_group_items" USING btree ("material_id");`;
  await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_batch_idx" ON "inventory_link_group_items" USING btree ("batch_id");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_material_idx" ON "inventory_link_group_items" USING btree ("group_id", "material_id");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_batch_idx" ON "inventory_link_group_items" USING btree ("group_id", "batch_id");`;
  await sql`
    INSERT INTO "material_categories" ("name", "sort_order")
    SELECT *
    FROM (VALUES
      ('贺卡', 10),
      ('彩盒', 20),
      ('标签类', 30),
      ('说明书', 40),
      ('贴纸', 50),
      ('包装袋', 60),
      ('配件', 70),
      ('其他', 90),
      ('未分类', 100)
    ) AS defaults("name", "sort_order")
    WHERE NOT EXISTS (SELECT 1 FROM "material_categories")
    ON CONFLICT ("name") DO NOTHING;
  `;
  await sql`
    INSERT INTO "material_categories" ("name", "sort_order")
    SELECT DISTINCT "category", 80
    FROM "materials"
    WHERE COALESCE(NULLIF("category", ''), '') <> ''
      AND NOT EXISTS (SELECT 1 FROM "material_categories")
    ON CONFLICT ("name") DO NOTHING;
  `;
  await sql`
    INSERT INTO "locations" ("name", "type")
    VALUES ('自己仓', 'warehouse')
    ON CONFLICT ("name") DO NOTHING;
  `;
  console.log("database:init complete");
}

async function runDatabaseCompatibilityPatch() {
  const sql = neon(getDatabaseUrl());
  await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`;

  const [movementTypeState] = await sql`
    SELECT EXISTS (
      SELECT 1 FROM pg_type WHERE typname = 'movement_type'
    ) AS "exists";
  `;

  if (movementTypeState?.exists) {
    await sql`ALTER TYPE "public"."movement_type" ADD VALUE IF NOT EXISTS 'STOCK_IN';`;
  }

  await sql`
    DO $$
    BEGIN
      CREATE TYPE "public"."material_location_status" AS ENUM ('active', 'used_up', 'inactive');
    EXCEPTION
      WHEN duplicate_object OR unique_violation THEN NULL;
    END $$;
  `;

  await sql`
    ALTER TABLE IF EXISTS "movements"
    ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);
  `;

  await sql`
    ALTER TABLE IF EXISTS "batches"
    ADD COLUMN IF NOT EXISTS "total_price" numeric(12, 2);
  `;

  const [batchesTableState] = await sql`
    SELECT to_regclass('public.batches') AS "tableName";
  `;

  if (batchesTableState?.tableName) {
    await sql`
      UPDATE "batches"
      SET "total_price" = COALESCE("total_price", "price" * "quantity")
      WHERE "total_price" IS NULL;
    `;
  }

  await sql`
    ALTER TABLE IF EXISTS "materials"
    ADD COLUMN IF NOT EXISTS "category" text DEFAULT '未分类' NOT NULL;
  `;

  const [materialsTableState] = await sql`
    SELECT to_regclass('public.materials') AS "tableName";
  `;

  if (materialsTableState?.tableName) {
    await sql`
      UPDATE "materials"
      SET "category" = CASE
        WHEN "name" ILIKE '%彩盒%' THEN '彩盒'
        WHEN "name" ILIKE '%贺卡%' THEN '贺卡'
        WHEN "name" ILIKE '%标签%' THEN '标签类'
        ELSE COALESCE(NULLIF("category", ''), '未分类')
      END
      WHERE "category" = '未分类' OR "category" = '';
    `;

    await sql`CREATE INDEX IF NOT EXISTS "materials_category_idx" ON "materials" USING btree ("category");`;
  }

  const [locationsTableState] = await sql`
    SELECT to_regclass('public.locations') AS "tableName";
  `;

  if (materialsTableState?.tableName && locationsTableState?.tableName) {
    await sql`
      CREATE TABLE IF NOT EXISTS "material_location_states" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "material_id" uuid NOT NULL REFERENCES "materials"("id"),
        "location_id" uuid NOT NULL REFERENCES "locations"("id"),
        "status" "material_location_status" DEFAULT 'active' NOT NULL,
        "updated_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_location_states_unique_idx" ON "material_location_states" USING btree ("material_id", "location_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "material_location_states_material_idx" ON "material_location_states" USING btree ("material_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "material_location_states_location_idx" ON "material_location_states" USING btree ("location_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "material_location_states_status_idx" ON "material_location_states" USING btree ("status");`;
  }

  if (materialsTableState?.tableName) {
    await sql`
      CREATE TABLE IF NOT EXISTS "bom_items" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "parent_material_id" uuid NOT NULL REFERENCES "materials"("id"),
        "child_material_id" uuid NOT NULL REFERENCES "materials"("id"),
        "quantity" numeric(12, 2) NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "bom_items_parent_child_idx" ON "bom_items" USING btree ("parent_material_id", "child_material_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "bom_items_parent_idx" ON "bom_items" USING btree ("parent_material_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "bom_items_child_idx" ON "bom_items" USING btree ("child_material_id");`;
  }

  if (materialsTableState?.tableName) {
    await sql`
      CREATE TABLE IF NOT EXISTS "material_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "sort_order" integer DEFAULT 0 NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_categories_name_idx" ON "material_categories" USING btree ("name");`;
    await sql`CREATE INDEX IF NOT EXISTS "material_categories_sort_idx" ON "material_categories" USING btree ("sort_order");`;
    await sql`
      INSERT INTO "material_categories" ("name", "sort_order")
      SELECT *
      FROM (VALUES
        ('贺卡', 10),
        ('彩盒', 20),
        ('标签类', 30),
        ('说明书', 40),
        ('贴纸', 50),
        ('包装袋', 60),
        ('配件', 70),
        ('其他', 90),
        ('未分类', 100)
      ) AS defaults("name", "sort_order")
      WHERE NOT EXISTS (SELECT 1 FROM "material_categories")
      ON CONFLICT ("name") DO NOTHING;
    `;
    await sql`
      INSERT INTO "material_categories" ("name", "sort_order")
      SELECT DISTINCT "category", 80
      FROM "materials"
      WHERE COALESCE(NULLIF("category", ''), '') <> ''
        AND NOT EXISTS (SELECT 1 FROM "material_categories")
      ON CONFLICT ("name") DO NOTHING;
    `;
  }

  if (materialsTableState?.tableName && batchesTableState?.tableName) {
    await sql`
      CREATE TABLE IF NOT EXISTS "inventory_link_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "name" text NOT NULL,
        "scope" text DEFAULT 'material' NOT NULL,
        "created_at" timestamp with time zone DEFAULT now() NOT NULL
      );
    `;

    await sql`
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
    `;

    await sql`CREATE INDEX IF NOT EXISTS "inventory_link_groups_scope_idx" ON "inventory_link_groups" USING btree ("scope");`;
    await sql`CREATE INDEX IF NOT EXISTS "inventory_link_groups_created_at_idx" ON "inventory_link_groups" USING btree ("created_at");`;
    await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_group_idx" ON "inventory_link_group_items" USING btree ("group_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_material_idx" ON "inventory_link_group_items" USING btree ("material_id");`;
    await sql`CREATE INDEX IF NOT EXISTS "inventory_link_group_items_batch_idx" ON "inventory_link_group_items" USING btree ("batch_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_material_idx" ON "inventory_link_group_items" USING btree ("group_id", "material_id");`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "inventory_link_group_items_group_batch_idx" ON "inventory_link_group_items" USING btree ("group_id", "batch_id");`;
  }
}

function shouldAutoInitDatabase() {
  const explicit = process.env.TESS_DATABASE_AUTO_INIT ?? process.env.DATABASE_AUTO_INIT;
  if (explicit) return explicit === "true";
  return process.env.NODE_ENV !== "production";
}

export async function ensureDatabaseReady() {
  globalThis.__tessDatabaseCompatPromise ??= runDatabaseCompatibilityPatch().catch((error) => {
    console.error("database:compat failed", error);
    globalThis.__tessDatabaseCompatPromise = undefined;
    throw error;
  });
  await globalThis.__tessDatabaseCompatPromise;

  if (!shouldAutoInitDatabase()) {
    if (!globalThis.__tessDatabaseInitSkipLogged) {
      console.log("database:init skipped for request runtime");
      globalThis.__tessDatabaseInitSkipLogged = true;
    }
    return;
  }

  globalThis.__tessDatabaseInitPromise ??= runDatabaseInit().catch((error) => {
    console.error("database:init failed", error);
    globalThis.__tessDatabaseInitPromise = undefined;
    throw error;
  });

  await globalThis.__tessDatabaseInitPromise;
}
