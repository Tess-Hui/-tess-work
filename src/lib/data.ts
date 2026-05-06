import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  fixedItems,
  memos,
  materialSizes,
  materials,
  batches,
  locations,
  movements,
  reminders,
  tasks,
  type Batch,
  type BatchStatus,
  type FixedItem,
  type LocationType,
  type Memo,
  type Material,
  type MaterialSize,
  type Movement,
  type MovementType,
  type Priority,
  type Reminder,
  type TaskStatus,
} from "@/db/schema";
import { getDb } from "@/db/client";
import { getShanghaiDateString, getShanghaiDayRange } from "@/lib/dates";

type TaskFilters = {
  status?: TaskStatus;
  search?: string;
  priority?: Priority | "all";
  liaison?: string;
  date?: string;
  sort?: string;
};

type FixedFilters = {
  search?: string;
  category?: string;
};

type ReminderFilters = {
  search?: string;
  date?: string;
  handled?: "all" | "handled" | "open";
};

type MemoFilters = {
  search?: string;
  tag?: string;
};

type BatchFilters = {
  date?: string;
  materialId?: string;
  materialName?: string;
  status?: BatchStatus | "all";
  supplier?: string;
  manufacturer?: string;
};

type MaterialFilters = {
  sort?: string;
};

type MaterialSizeFilters = {
  search?: string;
};

type MovementFilters = {
  startDate?: string;
  endDate?: string;
};

function compact<T>(items: Array<T | undefined | null | false>) {
  return items.filter(Boolean) as T[];
}

function searchValue(value?: string) {
  const clean = value?.trim();
  return clean ? `%${clean}%` : null;
}

function taskOrderBy(sort?: string) {
  const priorityRank = sql<number>`case ${tasks.priority} when 'high' then 3 when 'medium' then 2 else 1 end`;

  switch (sort) {
    case "priority-asc":
      return [asc(priorityRank), desc(tasks.createdAt)];
    case "created-desc":
      return [desc(tasks.createdAt)];
    case "created-asc":
      return [asc(tasks.createdAt)];
    case "priority-desc":
    default:
      return [desc(priorityRank), desc(tasks.createdAt)];
  }
}

export function numberValue(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function numericValue(value: number) {
  return value.toFixed(2);
}

function dateValue(value?: string | null) {
  return value || getShanghaiDateString();
}

function createBatchCode() {
  const date = getShanghaiDateString().replaceAll("-", "");
  return `B${date}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function addStock(stock: Map<string, number>, locationId: string, quantity: number) {
  stock.set(locationId, (stock.get(locationId) ?? 0) + quantity);
}

export function calculateBatchStock(
  batch: Batch,
  movementItems: Movement[],
) {
  const stock = new Map<string, number>();
  addStock(stock, batch.initialLocationId, numberValue(batch.quantity));

  for (const movement of movementItems) {
    const quantity = numberValue(movement.quantity);

    if (movement.fromLocationId) addStock(stock, movement.fromLocationId, -quantity);
    if (movement.toLocationId) addStock(stock, movement.toLocationId, quantity);
  }

  return stock;
}

async function getDefaultLocationId(db: Awaited<ReturnType<typeof getDb>>) {
  const [existing] = await db
    .select()
    .from(locations)
    .where(eq(locations.name, "自己仓"))
    .limit(1);
  if (existing) return existing.id;

  const [created] = await db
    .insert(locations)
    .values({ name: "自己仓", type: "warehouse" })
    .returning();
  return created.id;
}

async function refreshBatchStatus(batchId: string) {
  const db = await getDb();
  const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
  if (!batch || batch.status === "inactive") return;

  const movementItems = await db
    .select()
    .from(movements)
    .where(eq(movements.batchId, batchId));
  const remaining = [...calculateBatchStock(batch, movementItems).values()].reduce(
    (sum, quantity) => sum + quantity,
    0,
  );

  await db
    .update(batches)
    .set({ status: remaining <= 0 ? "used_up" : "active" })
    .where(eq(batches.id, batchId));
}

export async function listTasks(filters: TaskFilters = {}) {
  const db = await getDb();
  const clauses: SQL[] = [];

  if (filters.status) clauses.push(eq(tasks.status, filters.status));
  if (filters.priority && filters.priority !== "all") {
    clauses.push(eq(tasks.priority, filters.priority));
  }
  if (filters.liaison?.trim()) {
    clauses.push(ilike(tasks.liaison, `%${filters.liaison.trim()}%`));
  }
  if (filters.date) {
    const { start, end } = getShanghaiDayRange(filters.date);
    clauses.push(gte(tasks.plannedAt, start), lt(tasks.plannedAt, end));
  }

  const query = searchValue(filters.search);
  if (query) {
    const searchClause = or(
      ilike(tasks.content, query),
      ilike(tasks.notes, query),
      ilike(tasks.liaison, query),
    );
    if (searchClause) clauses.push(searchClause);
  }

  return db
    .select()
    .from(tasks)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(...taskOrderBy(filters.sort));
}

export async function getTaskById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return task ?? null;
}

export async function createTask(input: {
  content: string;
  plannedAt: Date | null;
  completedAt: Date | null;
  liaison: string;
  priority: Priority;
  notes: string;
}) {
  const db = await getDb();
  const [task] = await db
    .insert(tasks)
    .values({
      ...input,
      status: input.completedAt ? "completed" : "todo",
    })
    .returning();
  return task;
}

export async function updateTask(
  id: string,
  input: {
    content: string;
    plannedAt: Date | null;
    completedAt: Date | null;
    liaison: string;
    priority: Priority;
    notes: string;
  },
) {
  const db = await getDb();
  const [task] = await db
    .update(tasks)
    .set({
      ...input,
      status: input.completedAt ? "completed" : "todo",
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return task;
}

export async function completeTask(id: string) {
  const db = await getDb();
  await db
    .update(tasks)
    .set({ status: "completed", completedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function reopenTask(id: string) {
  const db = await getDb();
  await db
    .update(tasks)
    .set({ status: "todo", completedAt: null, updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function moveTaskToTrash(id: string) {
  const db = await getDb();
  await db
    .update(tasks)
    .set({ status: "trashed", trashedAt: new Date(), updatedAt: new Date() })
    .where(eq(tasks.id, id));
}

export async function restoreTask(id: string) {
  const db = await getDb();
  const [task] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  await db
    .update(tasks)
    .set({
      status: task?.completedAt ? "completed" : "todo",
      trashedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id));
}

export async function permanentlyDeleteTask(id: string) {
  const db = await getDb();
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function listFixedItems(filters: FixedFilters = {}) {
  const db = await getDb();
  const query = searchValue(filters.search);
  const clauses = compact<SQL>([
    filters.category?.trim() ? eq(fixedItems.category, filters.category.trim()) : null,
    query
      ? or(
          ilike(fixedItems.title, query),
          ilike(fixedItems.content, query),
          ilike(fixedItems.category, query),
        )
      : null,
  ]);

  return db
    .select()
    .from(fixedItems)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(fixedItems.pinned), asc(fixedItems.category), desc(fixedItems.updatedAt));
}

export async function getFixedItemById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [item] = await db.select().from(fixedItems).where(eq(fixedItems.id, id)).limit(1);
  return item ?? null;
}

export async function upsertFixedItem(
  input: Omit<FixedItem, "id" | "createdAt" | "updatedAt">,
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [item] = await db
      .update(fixedItems)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(fixedItems.id, id))
      .returning();
    return item;
  }

  const [item] = await db.insert(fixedItems).values(input).returning();
  return item;
}

export async function deleteFixedItem(id: string) {
  const db = await getDb();
  await db.delete(fixedItems).where(eq(fixedItems.id, id));
}

export async function toggleFixedPinned(id: string, pinned: boolean) {
  const db = await getDb();
  await db.update(fixedItems).set({ pinned, updatedAt: new Date() }).where(eq(fixedItems.id, id));
}

export async function toggleFixedDashboard(id: string, showOnDashboard: boolean) {
  const db = await getDb();
  await db
    .update(fixedItems)
    .set({ showOnDashboard, updatedAt: new Date() })
    .where(eq(fixedItems.id, id));
}

export async function listReminders(filters: ReminderFilters = {}) {
  const db = await getDb();
  const query = searchValue(filters.search);
  const clauses = compact<SQL>([
    filters.date ? eq(reminders.reminderDate, filters.date) : null,
    filters.handled === "handled" ? eq(reminders.handled, true) : null,
    filters.handled === "open" ? eq(reminders.handled, false) : null,
    query
      ? or(ilike(reminders.title, query), ilike(reminders.content, query))
      : null,
  ]);

  return db
    .select()
    .from(reminders)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(asc(reminders.reminderDate), asc(reminders.reminderTime), desc(reminders.createdAt));
}

export async function getReminderById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [reminder] = await db.select().from(reminders).where(eq(reminders.id, id)).limit(1);
  return reminder ?? null;
}

export async function upsertReminder(
  input: Omit<Reminder, "id" | "createdAt" | "updatedAt">,
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [reminder] = await db
      .update(reminders)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(reminders.id, id))
      .returning();
    return reminder;
  }

  const [reminder] = await db.insert(reminders).values(input).returning();
  return reminder;
}

export async function deleteReminder(id: string) {
  const db = await getDb();
  await db.delete(reminders).where(eq(reminders.id, id));
}

export async function toggleReminderHandled(id: string, handled: boolean) {
  const db = await getDb();
  await db
    .update(reminders)
    .set({ handled, updatedAt: new Date() })
    .where(eq(reminders.id, id));
}

export async function listMemos(filters: MemoFilters = {}) {
  const db = await getDb();
  const query = searchValue(filters.search);
  const clauses = compact<SQL>([
    filters.tag?.trim() ? ilike(memos.tags, `%${filters.tag.trim()}%`) : null,
    query
      ? or(ilike(memos.title, query), ilike(memos.content, query), ilike(memos.tags, query))
      : null,
  ]);

  return db
    .select()
    .from(memos)
    .where(clauses.length ? and(...clauses) : undefined)
    .orderBy(desc(memos.pinned), desc(memos.updatedAt));
}

export async function getMemoById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [memo] = await db.select().from(memos).where(eq(memos.id, id)).limit(1);
  return memo ?? null;
}

export async function upsertMemo(
  input: Omit<Memo, "id" | "createdAt" | "updatedAt">,
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [memo] = await db
      .update(memos)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(memos.id, id))
      .returning();
    return memo;
  }

  const [memo] = await db.insert(memos).values(input).returning();
  return memo;
}

export async function deleteMemo(id: string) {
  const db = await getDb();
  await db.delete(memos).where(eq(memos.id, id));
}

export async function toggleMemoPinned(id: string, pinned: boolean) {
  const db = await getDb();
  await db.update(memos).set({ pinned, updatedAt: new Date() }).where(eq(memos.id, id));
}

export async function listLocations() {
  const db = await getDb();
  await getDefaultLocationId(db);
  return db.select().from(locations).orderBy(asc(locations.name));
}

export async function getLocationStockSummary(filters?: {
  type?: LocationType | "all";
}) {
  const db = await getDb();
  const [locationItems, materialItems, batchItems, movementItems] = await Promise.all([
    listLocations(),
    db.select().from(materials),
    db.select().from(batches),
    db.select().from(movements),
  ]);

  const locationById = new Map(locationItems.map((location) => [location.id, location]));
  const materialById = new Map(materialItems.map((material) => [material.id, material]));
  const movementMap = new Map<string, Movement[]>();

  for (const movement of movementItems) {
    const batchMovements = movementMap.get(movement.batchId) ?? [];
    batchMovements.push(movement);
    movementMap.set(movement.batchId, batchMovements);
  }

  const summaryMap = new Map<
    string,
    {
      locationId: string;
      locationName: string;
      locationType: LocationType;
      totalStock: number;
      itemMap: Map<string, { materialId: string; materialName: string; stock: number }>;
    }
  >();

  for (const location of locationItems) {
    summaryMap.set(location.id, {
      locationId: location.id,
      locationName: location.name,
      locationType: location.type,
      totalStock: 0,
      itemMap: new Map(),
    });
  }

  for (const batch of batchItems) {
    const material = materialById.get(batch.materialId);
    if (!material) continue;

    const materialName = material.name.trim() || material.id;
    const detailStock = calculateBatchStock(batch, movementMap.get(batch.id) ?? []);

    for (const [locationId, quantity] of detailStock.entries()) {
      if (Math.abs(quantity) <= 0.0001) continue;

      const location = locationById.get(locationId);
      if (!location) continue;

      const summary = summaryMap.get(locationId);
      if (!summary) continue;

      summary.totalStock += quantity;

      const existingItem = summary.itemMap.get(materialName);
      if (existingItem) {
        existingItem.stock += quantity;
      } else {
        summary.itemMap.set(materialName, {
          materialId: material.id,
          materialName,
          stock: quantity,
        });
      }
    }
  }

  return [...summaryMap.values()]
    .map((summary) => ({
      locationId: summary.locationId,
      locationName: summary.locationName,
      locationType: summary.locationType,
      totalStock: summary.totalStock,
      items: [...summary.itemMap.values()]
        .filter((item) => Math.abs(item.stock) > 0.0001)
        .sort((a, b) => b.stock - a.stock || a.materialName.localeCompare(b.materialName, "zh-Hans-CN")),
    }))
    .filter((summary) => (filters?.type && filters.type !== "all" ? summary.locationType === filters.type : true))
    .sort((a, b) => b.totalStock - a.totalStock || a.locationName.localeCompare(b.locationName, "zh-Hans-CN"));
}

export async function getWarehouseStockSummary() {
  const db = await getDb();
  const [materialItems, batchItems, movementItems] = await Promise.all([
    db.select().from(materials),
    db.select().from(batches),
    db.select().from(movements),
  ]);

  const materialById = new Map(materialItems.map((material) => [material.id, material]));
  const movementMap = new Map<string, Movement[]>();

  for (const movement of movementItems) {
    const batchMovements = movementMap.get(movement.batchId) ?? [];
    batchMovements.push(movement);
    movementMap.set(movement.batchId, batchMovements);
  }

  const summaryMap = new Map<
    string,
    {
      warehouseName: string;
      totalStock: number;
      itemMap: Map<string, { materialId: string; materialName: string; stock: number }>;
    }
  >();

  for (const batch of batchItems) {
    const material = materialById.get(batch.materialId);
    if (!material) continue;

    const materialName = material.name.trim() || material.id;
    const currentRemaining = [...calculateBatchStock(batch, movementMap.get(batch.id) ?? []).values()].reduce(
      (sum, quantity) => sum + quantity,
      0,
    );
    if (Math.abs(currentRemaining) <= 0.0001) continue;

    const warehouseName = batch.supplier.trim() || "未填写仓库";
    const existing = summaryMap.get(warehouseName) ?? {
      warehouseName,
      totalStock: 0,
      itemMap: new Map<string, { materialId: string; materialName: string; stock: number }>(),
    };

    existing.totalStock += currentRemaining;
    const existingItem = existing.itemMap.get(materialName);
    if (existingItem) {
      existingItem.stock += currentRemaining;
    } else {
      existing.itemMap.set(materialName, {
        materialId: material.id,
        materialName,
        stock: currentRemaining,
      });
    }

    summaryMap.set(warehouseName, existing);
  }

  return [...summaryMap.values()]
    .map((summary) => ({
      locationId: summary.warehouseName,
      locationName: summary.warehouseName,
      totalStock: summary.totalStock,
      items: [...summary.itemMap.values()]
        .filter((item) => Math.abs(item.stock) > 0.0001)
        .sort((a, b) => b.stock - a.stock || a.materialName.localeCompare(b.materialName, "zh-Hans-CN")),
    }))
    .sort((a, b) => b.totalStock - a.totalStock || a.locationName.localeCompare(b.locationName, "zh-Hans-CN"));
}

export async function upsertLocation(
  input: { name: string; type: LocationType },
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [location] = await db
      .update(locations)
      .set(input)
      .where(eq(locations.id, id))
      .returning();
    return location;
  }

  const [location] = await db.insert(locations).values(input).returning();
  return location;
}

export async function deleteLocation(id: string) {
  const db = await getDb();
  const [usedByBatch] = await db
    .select({ value: count() })
    .from(batches)
    .where(eq(batches.initialLocationId, id));
  const [usedFrom] = await db
    .select({ value: count() })
    .from(movements)
    .where(eq(movements.fromLocationId, id));
  const [usedTo] = await db
    .select({ value: count() })
    .from(movements)
    .where(eq(movements.toLocationId, id));

  if ((usedByBatch?.value ?? 0) + (usedFrom?.value ?? 0) + (usedTo?.value ?? 0) > 0) {
    throw new Error("LOCATION_IN_USE");
  }

  await db.delete(locations).where(eq(locations.id, id));
}

export async function listMaterials(filters: MaterialFilters = {}) {
  const db = await getDb();
  const [materialItems, batchItems, movementItems] = await Promise.all([
    db.select().from(materials).orderBy(asc(materials.name)),
    db.select().from(batches),
    db.select().from(movements),
  ]);

  const perMaterialItems = materialItems.map((material) => {
    const materialBatches = batchItems.filter((batch) => batch.materialId === material.id);
    const currentStock = materialBatches.reduce((sum, batch) => {
      const batchMovements = movementItems.filter((movement) => movement.batchId === batch.id);
      return (
        sum +
        [...calculateBatchStock(batch, batchMovements).values()].reduce(
          (batchSum, quantity) => batchSum + quantity,
          0,
        )
      );
    }, 0);
    const latestMovement = movementItems
      .filter((movement) => materialBatches.some((batch) => batch.id === movement.batchId))
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    return { ...material, currentStock, latestUsedAt: latestMovement?.date ?? null };
  });

  const grouped = new Map<string, (typeof perMaterialItems)[number]>();
  for (const item of perMaterialItems) {
    const key = item.name.trim() || item.id;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, item);
      continue;
    }

    const latestUsedAt =
      String(item.latestUsedAt ?? "") > String(existing.latestUsedAt ?? "")
        ? item.latestUsedAt
        : existing.latestUsedAt;
    const representative = item.createdAt > existing.createdAt ? item : existing;

    grouped.set(key, {
      ...representative,
      name: key,
      type: representative.type || existing.type || item.type,
      size: representative.size || existing.size || item.size,
      unit: representative.unit || existing.unit || item.unit,
      remark: representative.remark || existing.remark || item.remark,
      currentStock: existing.currentStock + item.currentStock,
      latestUsedAt,
    });
  }

  const items = [...grouped.values()];

  switch (filters.sort) {
    case "created-asc":
      return items.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    case "name-asc":
      return items.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
    case "latest-used":
      return items.sort((a, b) => String(b.latestUsedAt ?? "").localeCompare(String(a.latestUsedAt ?? "")));
    case "stock-desc":
      return items.sort((a, b) => b.currentStock - a.currentStock);
    case "created-desc":
    default:
      return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

export async function getMaterialById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [material] = await db.select().from(materials).where(eq(materials.id, id)).limit(1);
  return material ?? null;
}

export async function upsertMaterial(
  input: Omit<Material, "id" | "createdAt">,
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [material] = await db
      .update(materials)
      .set(input)
      .where(eq(materials.id, id))
      .returning();
    return material;
  }

  const [material] = await db.insert(materials).values(input).returning();
  return material;
}

export async function listMaterialSizes(filters: MaterialSizeFilters = {}) {
  const db = await getDb();
  const query = searchValue(filters.search);
  return db
    .select()
    .from(materialSizes)
    .where(query ? or(ilike(materialSizes.name, query), ilike(materialSizes.remark, query)) : undefined)
    .orderBy(desc(materialSizes.createdAt));
}

export async function getMaterialSizeById(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [size] = await db
    .select()
    .from(materialSizes)
    .where(eq(materialSizes.id, id))
    .limit(1);
  return size ?? null;
}

export async function upsertMaterialSize(
  input: Omit<MaterialSize, "id" | "createdAt">,
  id?: string,
) {
  const db = await getDb();
  if (id) {
    const [size] = await db
      .update(materialSizes)
      .set(input)
      .where(eq(materialSizes.id, id))
      .returning();
    return size;
  }

  const [size] = await db
    .insert(materialSizes)
    .values(input)
    .onConflictDoUpdate({
      target: materialSizes.name,
      set: { remark: input.remark },
    })
    .returning();
  return size;
}

export async function deleteMaterialSize(id: string) {
  const db = await getDb();
  await db.delete(materialSizes).where(eq(materialSizes.id, id));
}

export async function getOrCreateMaterialByName(input: {
  name: string;
  type: string;
  size: string;
  unit: string;
  remark: string;
}) {
  const db = await getDb();
  const name = input.name.trim();
  const [existing] = await db
    .select()
    .from(materials)
    .where(eq(materials.name, name))
    .limit(1);

  if (!existing) {
    const [material] = await db
      .insert(materials)
      .values({ ...input, name })
      .returning();
    return material;
  }

  const next = {
    name,
    type: input.type.trim() || existing.type,
    size: input.size.trim() || existing.size,
    unit: input.unit.trim() || existing.unit,
    remark: input.remark.trim() || existing.remark,
  };

  if (
    next.type === existing.type &&
    next.size === existing.size &&
    next.unit === existing.unit &&
    next.remark === existing.remark
  ) {
    return existing;
  }

  const [material] = await db
    .update(materials)
    .set(next)
    .where(eq(materials.id, existing.id))
    .returning();
  return material;
}

export async function listBatches(filters: BatchFilters = {}) {
  const db = await getDb();
  const clauses = compact<SQL>([
    filters.date ? eq(batches.productionDate, filters.date) : null,
    filters.materialId ? eq(batches.materialId, filters.materialId) : null,
    filters.materialName?.trim() ? ilike(materials.name, `%${filters.materialName.trim()}%`) : null,
    filters.status && filters.status !== "all" ? eq(batches.status, filters.status) : null,
    filters.supplier?.trim() ? ilike(batches.supplier, `%${filters.supplier.trim()}%`) : null,
    filters.manufacturer?.trim()
      ? ilike(batches.manufacturer, `%${filters.manufacturer.trim()}%`)
      : null,
  ]);

  const [batchRows, movementItems] = await Promise.all([
    db
      .select({ batch: batches, material: materials, initialLocation: locations })
      .from(batches)
      .innerJoin(materials, eq(batches.materialId, materials.id))
      .innerJoin(locations, eq(batches.initialLocationId, locations.id))
      .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(batches.productionDate), desc(batches.createdAt)),
    db.select().from(movements),
  ]);

  return batchRows.map((row) => {
    const batchMovements = movementItems.filter((movement) => movement.batchId === row.batch.id);
    const currentRemaining = [...calculateBatchStock(row.batch, batchMovements).values()].reduce(
      (sum, quantity) => sum + quantity,
      0,
    );
    return { ...row, currentRemaining };
  });
}

export async function getBatchDetail(id?: string | null) {
  if (!id) return null;
  const db = await getDb();
  const [row] = await db
    .select({ batch: batches, material: materials, initialLocation: locations })
    .from(batches)
    .innerJoin(materials, eq(batches.materialId, materials.id))
    .innerJoin(locations, eq(batches.initialLocationId, locations.id))
    .where(eq(batches.id, id))
    .limit(1);
  if (!row) return null;

  const [movementRows, locationItems] = await Promise.all([
    db
      .select()
      .from(movements)
      .where(eq(movements.batchId, id))
      .orderBy(desc(movements.date), desc(movements.createdAt)),
    listLocations(),
  ]);
  const stock = calculateBatchStock(row.batch, movementRows);
  const stockDistribution = locationItems
    .map((location) => ({ location, quantity: stock.get(location.id) ?? 0 }))
    .filter((item) => Math.abs(item.quantity) > 0.0001);
  const currentRemaining = stockDistribution.reduce((sum, item) => sum + item.quantity, 0);

  return { ...row, movements: movementRows, locations: locationItems, stockDistribution, currentRemaining };
}

export async function createBatch(input: {
  materialName: string;
  materialType: string;
  materialSize: string;
  materialUnit: string;
  materialRemark: string;
  productionDate: string;
  quantity: number;
  price: number;
  supplier: string;
  manufacturer: string;
  initialLocationId?: string;
  status: BatchStatus;
  remark: string;
}) {
  const db = await getDb();
  const material = await getOrCreateMaterialByName({
    name: input.materialName,
    type: input.materialType,
    size: input.materialSize,
    unit: input.materialUnit,
    remark: input.materialRemark,
  });
  const initialLocationId = input.initialLocationId || (await getDefaultLocationId(db));
  const [batch] = await db
    .insert(batches)
    .values({
      batchCode: createBatchCode(),
      materialId: material.id,
      productionDate: input.productionDate,
      quantity: numericValue(input.quantity),
      price: numericValue(input.price),
      totalPrice: numericValue(input.quantity * input.price),
      supplier: input.supplier,
      manufacturer: input.manufacturer,
      initialLocationId,
      status: input.status,
      remark: input.remark,
    })
    .returning();
  return batch;
}

export async function updateBatch(
  id: string,
  input: {
    materialName: string;
    materialType: string;
    materialSize: string;
    materialUnit: string;
    materialRemark: string;
    productionDate: string;
    quantity: number;
    price: number;
    supplier: string;
    manufacturer: string;
    initialLocationId?: string;
    status: BatchStatus;
    remark: string;
  },
) {
  const db = await getDb();
  const material = await getOrCreateMaterialByName({
    name: input.materialName,
    type: input.materialType,
    size: input.materialSize,
    unit: input.materialUnit,
    remark: input.materialRemark,
  });
  const initialLocationId = input.initialLocationId || (await getDefaultLocationId(db));
  const [batch] = await db
    .update(batches)
    .set({
      materialId: material.id,
      productionDate: input.productionDate,
      quantity: numericValue(input.quantity),
      price: numericValue(input.price),
      totalPrice: numericValue(input.quantity * input.price),
      supplier: input.supplier,
      manufacturer: input.manufacturer,
      initialLocationId,
      status: input.status,
      remark: input.remark,
    })
    .where(eq(batches.id, id))
    .returning();
  await refreshBatchStatus(id);
  return batch;
}

export async function createMovement(input: {
  batchId: string;
  date: string;
  type: MovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  remark: string;
}) {
  const detail = await getBatchDetail(input.batchId);
  if (!detail) throw new Error("BATCH_NOT_FOUND");
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
  const db = await getDb();
  const defaultLocationId = await getDefaultLocationId(db);
  const fromLocationId =
    input.type === "OUT" && !input.fromLocationId
      ? defaultLocationId
      : input.fromLocationId || null;
  const toLocationId =
    input.type === "RETURN" && !input.toLocationId
      ? defaultLocationId
      : input.toLocationId || null;

  if (fromLocationId) {
    const available = detail.stockDistribution.find(
      (item) => item.location.id === fromLocationId,
    )?.quantity ?? 0;
    if (available + 0.0001 < input.quantity) throw new Error("INSUFFICIENT_STOCK");
  }

  const [movement] = await db
    .insert(movements)
    .values({
      batchId: input.batchId,
      date: dateValue(input.date),
      type: input.type,
      fromLocationId,
      toLocationId,
      quantity: numericValue(input.quantity),
      remark: input.remark,
    })
    .returning();
  await refreshBatchStatus(input.batchId);
  return movement;
}

export async function getMaterialHomeData() {
  const [batchItems, warehouseStockSummary] = await Promise.all([
    listBatches(),
    getWarehouseStockSummary(),
  ]);
  const locationStocks = warehouseStockSummary.filter((location) => Math.abs(location.totalStock) > 0.0001);

  return {
    recentBatches: batchItems.slice(0, 5),
    locationStocks,
    batchCount: batchItems.length,
    totalStock: warehouseStockSummary.reduce((sum, location) => sum + location.totalStock, 0),
  };
}

export async function listMovementsForExport(filters: MovementFilters = {}) {
  const db = await getDb();
  const clauses = compact<SQL>([
    filters.startDate ? gte(movements.date, filters.startDate) : null,
    filters.endDate ? lte(movements.date, filters.endDate) : null,
  ]);

  const [movementRows, locationItems] = await Promise.all([
    db
    .select({
      movement: movements,
      batch: batches,
      material: materials,
    })
    .from(movements)
    .innerJoin(batches, eq(movements.batchId, batches.id))
    .innerJoin(materials, eq(batches.materialId, materials.id))
    .where(clauses.length ? and(...clauses) : undefined)
      .orderBy(desc(movements.date), desc(movements.createdAt)),
    listLocations(),
  ]);
  const locationById = new Map(locationItems.map((location) => [location.id, location]));

  return movementRows.map((row) => ({
    ...row,
    fromLocation: row.movement.fromLocationId
      ? locationById.get(row.movement.fromLocationId) ?? null
      : null,
    toLocation: row.movement.toLocationId
      ? locationById.get(row.movement.toLocationId) ?? null
      : null,
  }));
}

export async function getInventoryExportRows() {
  const db = await getDb();
  const [batchItems, locationItems, movementItems] = await Promise.all([
    listBatches(),
    listLocations(),
    db.select().from(movements),
  ]);
  return batchItems.flatMap((row) => {
    const detailStock = calculateBatchStock(
      row.batch,
      movementItems.filter((movement) => movement.batchId === row.batch.id),
    );
    return locationItems.map((location) => ({
      batch: row.batch,
      material: row.material,
      location,
      quantity: detailStock.get(location.id) ?? 0,
    })).filter((rowItem) => Math.abs(rowItem.quantity) > 0.0001);
  });
}

export async function getDashboardData() {
  const db = await getDb();
  const today = getShanghaiDateString();
  const { start, end } = getShanghaiDayRange(today);

  const [
    pendingCount,
    todayReminderCount,
    completedCount,
    highPriorityCount,
    fixedCount,
    memoCount,
    upcomingTasks,
    pinnedFixed,
    reminderPreview,
    recentMemos,
    ganttTasks,
    warehouseStockPreview,
  ] = await Promise.all([
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "todo")),
    db
      .select({ value: count() })
      .from(reminders)
      .where(and(eq(reminders.reminderDate, today), eq(reminders.handled, false))),
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, "completed")),
    db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.priority, "high"), ne(tasks.status, "trashed"))),
    db.select({ value: count() }).from(fixedItems),
    db.select({ value: count() }).from(memos),
    db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "todo"),
          or(and(gte(tasks.plannedAt, start), lt(tasks.plannedAt, end)), gte(tasks.plannedAt, start)),
        ),
      )
      .orderBy(asc(tasks.plannedAt))
      .limit(6),
    db
      .select()
      .from(fixedItems)
      .where(and(eq(fixedItems.pinned, true), eq(fixedItems.showOnDashboard, true)))
      .orderBy(desc(fixedItems.updatedAt))
      .limit(5),
    db
      .select()
      .from(reminders)
      .where(and(gte(reminders.reminderDate, today), eq(reminders.handled, false)))
      .orderBy(asc(reminders.reminderDate), asc(reminders.reminderTime))
      .limit(6),
    db.select().from(memos).orderBy(desc(memos.pinned), desc(memos.updatedAt)).limit(5),
    db
      .select()
      .from(tasks)
      .where(ne(tasks.status, "trashed"))
      .orderBy(asc(tasks.plannedAt), desc(tasks.createdAt))
      .limit(8),
    getWarehouseStockSummary(),
  ]);

  return {
    counts: {
      pendingTasks: pendingCount[0]?.value ?? 0,
      todayReminders: todayReminderCount[0]?.value ?? 0,
      completedTasks: completedCount[0]?.value ?? 0,
      highPriorityTasks: highPriorityCount[0]?.value ?? 0,
      fixedItems: fixedCount[0]?.value ?? 0,
      memos: memoCount[0]?.value ?? 0,
    },
    upcomingTasks,
    pinnedFixed,
    reminderPreview,
    recentMemos,
    locationStockPreview: warehouseStockPreview
      .filter((location) => Math.abs(location.totalStock) > 0.0001)
      .slice(0, 5),
    ganttTasks,
  };
}

export async function listGanttTasks() {
  const db = await getDb();
  return db
    .select()
    .from(tasks)
    .where(ne(tasks.status, "trashed"))
    .orderBy(asc(tasks.plannedAt), desc(tasks.createdAt));
}
