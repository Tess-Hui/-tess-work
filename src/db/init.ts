import { neon } from "@neondatabase/serverless";

declare global {
  var __tessDatabaseInitPromise: Promise<void> | undefined;
}

function getDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Configure Neon Postgres before using the app.");
  }

  return databaseUrl;
}

async function runDatabaseInit() {
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
      "remark" text DEFAULT '' NOT NULL,
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
  await sql`CREATE INDEX IF NOT EXISTS "materials_type_idx" ON "materials" USING btree ("type");`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS "material_sizes_name_idx" ON "material_sizes" USING btree ("name");`;
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
  await sql`
    INSERT INTO "locations" ("name", "type")
    VALUES ('自己仓', 'warehouse')
    ON CONFLICT ("name") DO NOTHING;
  `;
}

export async function ensureDatabaseReady() {
  globalThis.__tessDatabaseInitPromise ??= runDatabaseInit().catch((error) => {
    globalThis.__tessDatabaseInitPromise = undefined;
    throw error;
  });

  await globalThis.__tessDatabaseInitPromise;
}
