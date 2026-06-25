import {
  boolean,
  date,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const priorityEnum = pgEnum("priority", ["high", "medium", "low"]);
export const taskStatusEnum = pgEnum("task_status", [
  "todo",
  "completed",
  "trashed",
]);
export const batchStatusEnum = pgEnum("batch_status", [
  "active",
  "used_up",
  "inactive",
]);
export const materialLocationStatusEnum = pgEnum("material_location_status", [
  "active",
  "used_up",
  "inactive",
]);
export const locationTypeEnum = pgEnum("location_type", [
  "warehouse",
  "factory",
  "other",
]);
export const movementTypeEnum = pgEnum("movement_type", [
  "OUT",
  "TRANSFER",
  "RETURN",
  "SCRAP",
  "CONSUME",
  "STOCK_IN",
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

export const materials = pgTable(
  "materials",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    category: text("category").notNull().default("未分类"),
    type: text("type").notNull().default(""),
    size: text("size").notNull().default(""),
    unit: text("unit").notNull().default(""),
    remark: text("remark").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("materials_name_idx").on(table.name),
    index("materials_category_idx").on(table.category),
    index("materials_type_idx").on(table.type),
  ],
);

export const materialSizes = pgTable(
  "material_sizes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    remark: text("remark").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("material_sizes_name_idx").on(table.name),
  ],
);

export const locations = pgTable(
  "locations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    type: locationTypeEnum("type").notNull().default("warehouse"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("locations_name_idx").on(table.name),
  ],
);

export const batches = pgTable(
  "batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchCode: text("batch_code").notNull(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    productionDate: date("production_date").notNull(),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    price: numeric("price", { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }).notNull(),
    supplier: text("supplier").notNull().default(""),
    manufacturer: text("manufacturer").notNull().default(""),
    initialLocationId: uuid("initial_location_id")
      .notNull()
      .references(() => locations.id),
    status: batchStatusEnum("status").notNull().default("active"),
    remark: text("remark").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("batches_code_idx").on(table.batchCode),
    index("batches_material_idx").on(table.materialId),
    index("batches_status_idx").on(table.status),
    index("batches_production_date_idx").on(table.productionDate),
    index("batches_supplier_idx").on(table.supplier),
    index("batches_manufacturer_idx").on(table.manufacturer),
  ],
);

export const movements = pgTable(
  "movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id),
    date: date("date").notNull(),
    type: movementTypeEnum("type").notNull(),
    fromLocationId: uuid("from_location_id").references(() => locations.id),
    toLocationId: uuid("to_location_id").references(() => locations.id),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    totalPrice: numeric("total_price", { precision: 12, scale: 2 }),
    remark: text("remark").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("movements_batch_idx").on(table.batchId),
    index("movements_date_idx").on(table.date),
    index("movements_type_idx").on(table.type),
    index("movements_from_location_idx").on(table.fromLocationId),
    index("movements_to_location_idx").on(table.toLocationId),
  ],
);

export const materialLocationStates = pgTable(
  "material_location_states",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    materialId: uuid("material_id")
      .notNull()
      .references(() => materials.id),
    locationId: uuid("location_id")
      .notNull()
      .references(() => locations.id),
    status: materialLocationStatusEnum("status").notNull().default("active"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("material_location_states_unique_idx").on(table.materialId, table.locationId),
    index("material_location_states_material_idx").on(table.materialId),
    index("material_location_states_location_idx").on(table.locationId),
    index("material_location_states_status_idx").on(table.status),
  ],
);

export const bomItems = pgTable(
  "bom_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    parentMaterialId: uuid("parent_material_id")
      .notNull()
      .references(() => materials.id),
    childMaterialId: uuid("child_material_id")
      .notNull()
      .references(() => materials.id),
    quantity: numeric("quantity", { precision: 12, scale: 2 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("bom_items_parent_child_idx").on(table.parentMaterialId, table.childMaterialId),
    index("bom_items_parent_idx").on(table.parentMaterialId),
    index("bom_items_child_idx").on(table.childMaterialId),
  ],
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type FixedItem = typeof fixedItems.$inferSelect;
export type Reminder = typeof reminders.$inferSelect;
export type Memo = typeof memos.$inferSelect;
export type Material = typeof materials.$inferSelect;
export type MaterialSize = typeof materialSizes.$inferSelect;
export type Batch = typeof batches.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type Movement = typeof movements.$inferSelect;
export type MaterialLocationState = typeof materialLocationStates.$inferSelect;
export type BomItem = typeof bomItems.$inferSelect;
export type Priority = "high" | "medium" | "low";
export type TaskStatus = "todo" | "completed" | "trashed";
export type BatchStatus = "active" | "used_up" | "inactive";
export type MaterialLocationStatus = "active" | "used_up" | "inactive";
export type LocationType = "warehouse" | "factory" | "other";
export type MovementType = "OUT" | "TRANSFER" | "RETURN" | "SCRAP" | "CONSUME" | "STOCK_IN";
