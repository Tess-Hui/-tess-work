import {
  boolean,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const priorityEnum = pgEnum("priority", ["high", "medium", "low"]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "completed",
  "trashed",
]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    content: text("content").notNull(),
    plannedAt: timestamp("planned_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    liaison: text("liaison").notNull().default(""),
    priority: priorityEnum("priority").notNull().default("medium"),
    status: taskStatusEnum("status").notNull().default("todo"),
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    trashedAt: timestamp("trashed_at", { withTimezone: true }),
  },
  (table) => [
    index("tasks_status_idx").on(table.status),
    index("tasks_priority_idx").on(table.priority),
    index("tasks_planned_at_idx").on(table.plannedAt),
  ],
);

export const fixedItems = pgTable(
  "fixed_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    category: text("category").notNull().default("General"),
    priority: priorityEnum("priority").notNull().default("medium"),
    pinned: boolean("pinned").notNull().default(false),
    showOnDashboard: boolean("show_on_dashboard").notNull().default(true),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("fixed_items_category_idx").on(table.category),
    index("fixed_items_pinned_idx").on(table.pinned),
  ],
);

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    reminderDate: date("reminder_date").notNull(),
    reminderTime: text("reminder_time").notNull().default(""),
    priority: priorityEnum("priority").notNull().default("medium"),
    handled: boolean("handled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reminders_date_idx").on(table.reminderDate),
    index("reminders_handled_idx").on(table.handled),
  ],
);

export const memos = pgTable(
  "memos",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    tags: text("tags").notNull().default(""),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("memos_pinned_idx").on(table.pinned),
    index("memos_tags_idx").on(table.tags),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type FixedItem = typeof fixedItems.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Memo = typeof memos.$inferSelect;
export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "completed" | "trashed";
