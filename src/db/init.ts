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

  await sql`CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "tasks" USING btree ("status");`;
  await sql`CREATE INDEX IF NOT EXISTS "tasks_priority_idx" ON "tasks" USING btree ("priority");`;
  await sql`CREATE INDEX IF NOT EXISTS "tasks_planned_at_idx" ON "tasks" USING btree ("planned_at");`;
  await sql`CREATE INDEX IF NOT EXISTS "fixed_items_category_idx" ON "fixed_items" USING btree ("category");`;
  await sql`CREATE INDEX IF NOT EXISTS "fixed_items_pinned_idx" ON "fixed_items" USING btree ("pinned");`;
  await sql`CREATE INDEX IF NOT EXISTS "reminders_date_idx" ON "reminders" USING btree ("reminder_date");`;
  await sql`CREATE INDEX IF NOT EXISTS "reminders_handled_idx" ON "reminders" USING btree ("handled");`;
  await sql`CREATE INDEX IF NOT EXISTS "memos_pinned_idx" ON "memos" USING btree ("pinned");`;
  await sql`CREATE INDEX IF NOT EXISTS "memos_tags_idx" ON "memos" USING btree ("tags");`;
}

export async function ensureDatabaseReady() {
  globalThis.__tessDatabaseInitPromise ??= runDatabaseInit().catch((error) => {
    globalThis.__tessDatabaseInitPromise = undefined;
    throw error;
  });

  await globalThis.__tessDatabaseInitPromise;
}
