CREATE TYPE "public"."priority" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('todo', 'completed', 'trashed');--> statement-breakpoint
CREATE TABLE "fixed_items" (
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
--> statement-breakpoint
CREATE TABLE "memos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"tags" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
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
--> statement-breakpoint
CREATE TABLE "tasks" (
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
--> statement-breakpoint
CREATE INDEX "fixed_items_category_idx" ON "fixed_items" USING btree ("category");--> statement-breakpoint
CREATE INDEX "fixed_items_pinned_idx" ON "fixed_items" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "memos_pinned_idx" ON "memos" USING btree ("pinned");--> statement-breakpoint
CREATE INDEX "memos_tags_idx" ON "memos" USING btree ("tags");--> statement-breakpoint
CREATE INDEX "reminders_date_idx" ON "reminders" USING btree ("reminder_date");--> statement-breakpoint
CREATE INDEX "reminders_handled_idx" ON "reminders" USING btree ("handled");--> statement-breakpoint
CREATE INDEX "tasks_status_idx" ON "tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tasks_priority_idx" ON "tasks" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "tasks_planned_at_idx" ON "tasks" USING btree ("planned_at");