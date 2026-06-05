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
  type Location as DbLocation,
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

type InventoryBatchSummary = {
  batch: Batch;
  material: Material;
  initialLocation: DbLocation;
  currentRemaining: number;
  stockDistribution: Array<{
    location: DbLocation;
    quantity: number;
  }>;
  movements: Movement[];
};

type InventoryReplenishState = BatchStatus;

type InventoryLocationItemSummary = {
  materialId: string;
  materialName: string;
  stock: number;
  status: InventoryReplenishState;
  activeStock: number;
};

type InventoryLocationDetailRow = {
  batchId: string;
  batchCode: string;
  materialId: string;
  materialName: string;
  quantity: number;
  status: InventoryReplenishState;
  sourceText: string;
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

function unitPriceFromTotal(quantity: number, totalPrice: number) {
  return quantity > 0 ? totalPrice / quantity : 0;
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

function movementSortDesc(a: Movement, b: Movement) {
  return String(b.date).localeCompare(String(a.date)) || b.createdAt.getTime() - a.createdAt.getTime();
}

function sortInventoryItems<T extends { stock: number; materialName: string }>(items: T[]) {
  return items.sort((a, b) => {
    const aZero = Math.abs(a.stock) <= 0.0001;
    const bZero = Math.abs(b.stock) <= 0.0001;
    if (aZero !== bZero) return aZero ? 1 : -1;
    return b.stock - a.stock || a.materialName.localeCompare(b.materialName, "zh-Hans-CN");
  });
}

function mergeInventoryStatus(current: InventoryReplenishState | undefined, next: InventoryReplenishState) {
  if (current === "active" || next === "active") return "active";
  if (current === "used_up" || next === "used_up") return "used_up";
  return next;
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

function normalizeMovementLocations(input: {
  type: MovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
}, defaultLocationId: string) {
  const fromLocationId =
    input.type === "OUT" && !input.fromLocationId
      ? defaultLocationId
      : input.fromLocationId || null;
  const toLocationId =
    input.type === "RETURN" && !input.toLocationId
      ? defaultLocationId
      : input.toLocationId || null;

  return { fromLocationId, toLocationId };
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
  if (!batch) return;
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

export async function getTaskStats(status: TaskStatus) {
  const db = await getDb();
  const [
    total,
    high,
    medium,
    low,
  ] = await Promise.all([
    db.select({ value: count() }).from(tasks).where(eq(tasks.status, status)),
    db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.status, status), eq(tasks.priority, "high"))),
    db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.status, status), eq(tasks.priority, "medium"))),
    db
      .select({ value: count() })
      .from(tasks)
      .where(and(eq(tasks.status, status), eq(tasks.priority, "low"))),
  ]);

  return {
    total: total[0]?.value ?? 0,
    high: high[0]?.value ?? 0,
    medium: medium[0]?.value ?? 0,
    low: low[0]?.value ?? 0,
  };
}

export async function getTodoTaskStats() {
  return getTaskStats("todo");
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

export async function listWarehouseLocations() {
  const items = await listLocations();
  return items.filter((location) => location.type === "warehouse");
}

function resolveBatchInitialWarehouseLocation(
  batch: Batch,
  locationItems: Awaited<ReturnType<typeof listLocations>>,
) {
  const warehouseByName = new Map(
    locationItems
      .filter((location) => location.type === "warehouse")
      .map((location) => [location.name.trim(), location]),
  );
  const warehouseById = new Map(
    locationItems
      .filter((location) => location.type === "warehouse")
      .map((location) => [location.id, location]),
  );
  const supplierName = batch.supplier?.trim();

  if (supplierName && warehouseByName.has(supplierName)) {
    return warehouseByName.get(supplierName) ?? null;
  }

  if (warehouseById.has(batch.initialLocationId)) {
    return warehouseById.get(batch.initialLocationId) ?? null;
  }

  return locationItems.find((location) => location.id === batch.initialLocationId) ?? null;
}

async function buildInventorySummary() {
  const db = await getDb();
  const [locationItems, batchRows, movementItems] = await Promise.all([
    listLocations(),
    db
      .select({ batch: batches, material: materials, initialLocation: locations })
      .from(batches)
      .innerJoin(materials, eq(batches.materialId, materials.id))
      .innerJoin(locations, eq(batches.initialLocationId, locations.id))
      .orderBy(desc(batches.productionDate), desc(batches.createdAt)),
    db.select().from(movements),
  ]);

  const movementMap = new Map<string, Movement[]>();

  for (const movement of movementItems) {
    const batchMovements = movementMap.get(movement.batchId) ?? [];
    batchMovements.push(movement);
    movementMap.set(movement.batchId, batchMovements);
  }

  const locationById = new Map(locationItems.map((location) => [location.id, location]));

  const summaryMap = new Map<
    string,
    {
      locationId: string;
      locationName: string;
      locationType: LocationType;
      totalStock: number;
      itemMap: Map<string, InventoryLocationItemSummary>;
      detailRows: InventoryLocationDetailRow[];
    }
  >();
  const materialSummaryMap = new Map<
    string,
    {
      id: string;
      name: string;
      type: string;
      size: string;
      unit: string;
      remark: string;
      createdAt: Date;
      currentStock: number;
      latestUsedAt: string | Date | null;
    }
  >();
  const byBatch: InventoryBatchSummary[] = [];

  for (const location of locationItems) {
    summaryMap.set(location.id, {
      locationId: location.id,
      locationName: location.name,
      locationType: location.type,
      totalStock: 0,
      itemMap: new Map(),
      detailRows: [],
    });
  }

  for (const row of batchRows) {
    const batchMovements = (movementMap.get(row.batch.id) ?? []).sort(movementSortDesc);
    const materialName = row.material.name.trim() || row.material.id;
    const resolvedInitialLocation = resolveBatchInitialWarehouseLocation(row.batch, locationItems);
    const effectiveBatch = resolvedInitialLocation
      ? { ...row.batch, initialLocationId: resolvedInitialLocation.id }
      : row.batch;
    const detailStock = calculateBatchStock(effectiveBatch, batchMovements);
    const relatedLocationIds = new Set<string>([effectiveBatch.initialLocationId]);
    for (const movement of batchMovements) {
      if (movement.fromLocationId) relatedLocationIds.add(movement.fromLocationId);
      if (movement.toLocationId) relatedLocationIds.add(movement.toLocationId);
    }
    const stockDistribution = locationItems
      .filter((location) => relatedLocationIds.has(location.id))
      .map((location) => ({ location, quantity: detailStock.get(location.id) ?? 0 }));
    const currentRemaining = stockDistribution.reduce((sum, item) => sum + item.quantity, 0);

    byBatch.push({
      ...row,
      batch: effectiveBatch,
      initialLocation: resolvedInitialLocation ?? row.initialLocation,
      currentRemaining,
      stockDistribution,
      movements: batchMovements,
    });

    const materialEntry = materialSummaryMap.get(materialName);
    const latestMovement = [...batchMovements].sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    if (materialEntry) {
      materialEntry.currentStock += currentRemaining;
      if (String(latestMovement?.date ?? "") > String(materialEntry.latestUsedAt ?? "")) {
        materialEntry.latestUsedAt = latestMovement?.date ?? materialEntry.latestUsedAt;
      }
      if (row.material.createdAt > materialEntry.createdAt) {
        materialEntry.id = row.material.id;
        materialEntry.type = row.material.type || materialEntry.type;
        materialEntry.size = row.material.size || materialEntry.size;
        materialEntry.unit = row.material.unit || materialEntry.unit;
        materialEntry.remark = row.material.remark || materialEntry.remark;
        materialEntry.createdAt = row.material.createdAt;
      }
    } else {
      materialSummaryMap.set(materialName, {
        id: row.material.id,
        name: materialName,
        type: row.material.type,
        size: row.material.size,
        unit: row.material.unit,
        remark: row.material.remark,
        createdAt: row.material.createdAt,
        currentStock: currentRemaining,
        latestUsedAt: latestMovement?.date ?? null,
      });
    }

    for (const { location, quantity } of stockDistribution) {
      if (!location) continue;

      const summary = summaryMap.get(location.id);
      if (!summary) continue;

      summary.totalStock += quantity;

      const existingItem = summary.itemMap.get(materialName);
      if (existingItem) {
        existingItem.stock += quantity;
        existingItem.status = mergeInventoryStatus(existingItem.status, effectiveBatch.status);
        if (effectiveBatch.status === "active") {
          existingItem.activeStock += quantity;
        }
      } else {
        summary.itemMap.set(materialName, {
          materialId: row.material.id,
          materialName,
          stock: quantity,
          status: effectiveBatch.status,
          activeStock: effectiveBatch.status === "active" ? quantity : 0,
        });
      }

      const latestInbound = batchMovements.find((movement) => movement.toLocationId === location.id);
      const latestRelated = batchMovements.find(
        (movement) => movement.toLocationId === location.id || movement.fromLocationId === location.id,
      );
      const fromName = latestInbound?.fromLocationId
        ? locationById.get(latestInbound.fromLocationId)?.name ?? "其他地点"
        : "";
      let sourceText = `初始入库到${location.name}`;

      if (latestInbound) {
        const quantityText = numberValue(latestInbound.quantity);
        if (latestInbound.type === "TRANSFER") {
          sourceText = `从${fromName}调货过来，数量 ${quantityText}`;
        } else if (latestInbound.type === "OUT") {
          sourceText = `从${fromName}发货过来，数量 ${quantityText}`;
        } else if (latestInbound.type === "RETURN") {
          sourceText = `从${fromName}退回，数量 ${quantityText}`;
        } else if (latestInbound.type === "STOCK_IN") {
          sourceText = `新增库存到${location.name}，数量 ${quantityText}`;
        } else {
          sourceText = `最近入库到${location.name}，数量 ${quantityText}`;
        }
      } else if (latestRelated) {
        sourceText = `最近流转后当前库存为 ${quantity}`;
      }

      summary.detailRows.push({
        batchId: effectiveBatch.id,
        batchCode: effectiveBatch.batchCode,
        materialId: row.material.id,
        materialName,
        quantity,
        status: effectiveBatch.status,
        sourceText,
      });
    }
  }

  const byLocation = [...summaryMap.values()]
    .map((summary) => ({
      locationId: summary.locationId,
      locationName: summary.locationName,
      locationType: summary.locationType,
      totalStock: summary.totalStock,
      items: sortInventoryItems([...summary.itemMap.values()]),
      detailRows: [...summary.detailRows].sort((a, b) => {
        const aZero = Math.abs(a.quantity) <= 0.0001;
        const bZero = Math.abs(b.quantity) <= 0.0001;
        if (aZero !== bZero) return aZero ? 1 : -1;
        return b.quantity - a.quantity || a.materialName.localeCompare(b.materialName, "zh-Hans-CN");
      }),
    }))
    .sort((a, b) => b.totalStock - a.totalStock || a.locationName.localeCompare(b.locationName, "zh-Hans-CN"));

  const byMaterial = [...materialSummaryMap.values()];

  return { byBatch, byLocation, byMaterial };
}

export async function getInventorySummary() {
  return buildInventorySummary();
}

export async function getLocationStockSummary(filters?: {
  type?: LocationType | "all";
}) {
  const summary = await buildInventorySummary();
  return summary.byLocation.filter((item) =>
    filters?.type && filters.type !== "all" ? item.locationType === filters.type : true,
  );
}

export async function getWarehouseStockSummary() {
  return getLocationStockSummary({ type: "warehouse" });
}

export async function getLocationInventoryDetail(id?: string | null) {
  if (!id) return null;
  const summary = await getInventorySummary();
  return summary.byLocation.find((location) => location.locationId === id) ?? null;
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
  const summary = await buildInventorySummary();
  const items = [...summary.byMaterial];

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
  const summary = await buildInventorySummary();
  return summary.byBatch.filter((row) => {
    if (filters.date && String(row.batch.productionDate) !== filters.date) return false;
    if (filters.materialId && row.batch.materialId !== filters.materialId) return false;
    if (filters.materialName?.trim() && !row.material.name.toLowerCase().includes(filters.materialName.trim().toLowerCase())) {
      return false;
    }
    if (filters.status && filters.status !== "all" && row.batch.status !== filters.status) return false;
    if (filters.supplier?.trim() && !row.batch.supplier.toLowerCase().includes(filters.supplier.trim().toLowerCase())) {
      return false;
    }
    return true;
  });
}

export async function getBatchDetail(id?: string | null) {
  if (!id) return null;
  const [summary, locationItems] = await Promise.all([getInventorySummary(), listLocations()]);
  const row = summary.byBatch.find((item) => item.batch.id === id);
  if (!row) return null;
  return { ...row, locations: locationItems };
}

export async function createBatch(input: {
  materialName: string;
  materialType: string;
  materialSize: string;
  materialUnit: string;
  materialRemark: string;
  productionDate: string;
  quantity: number;
  totalPrice: number;
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
  const unitPrice = unitPriceFromTotal(input.quantity, input.totalPrice);
  const [batch] = await db
    .insert(batches)
    .values({
      batchCode: createBatchCode(),
      materialId: material.id,
      productionDate: input.productionDate,
      quantity: numericValue(input.quantity),
      price: numericValue(unitPrice),
      totalPrice: numericValue(input.totalPrice),
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
    totalPrice: number;
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
  const unitPrice = unitPriceFromTotal(input.quantity, input.totalPrice);
  const [batch] = await db
    .update(batches)
    .set({
      materialId: material.id,
      productionDate: input.productionDate,
      quantity: numericValue(input.quantity),
      price: numericValue(unitPrice),
      totalPrice: numericValue(input.totalPrice),
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

export async function deleteBatch(id: string) {
  const db = await getDb();
  await db.delete(movements).where(eq(movements.batchId, id));
  await db.delete(batches).where(eq(batches.id, id));
}

export async function deleteMovement(id: string) {
  const db = await getDb();
  const [movement] = await db
    .delete(movements)
    .where(eq(movements.id, id))
    .returning();
  if (movement) {
    await refreshBatchStatus(movement.batchId);
  }
  return movement;
}

export async function createMovement(input: {
  batchId: string;
  date: string;
  type: MovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  totalPrice?: number | null;
  remark: string;
}) {
  const detail = await getBatchDetail(input.batchId);
  if (!detail) throw new Error("BATCH_NOT_FOUND");
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
  const db = await getDb();
  const defaultLocationId = await getDefaultLocationId(db);
  const { fromLocationId, toLocationId } = normalizeMovementLocations(input, defaultLocationId);

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
      totalPrice: input.type === "STOCK_IN" ? numericValue(input.totalPrice ?? 0) : null,
      remark: input.remark,
    })
    .returning();
  await refreshBatchStatus(input.batchId);
  return movement;
}

export async function updateMovement(input: {
  id: string;
  batchId: string;
  date: string;
  type: MovementType;
  fromLocationId?: string | null;
  toLocationId?: string | null;
  quantity: number;
  totalPrice?: number | null;
  remark: string;
}) {
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
  const db = await getDb();
  const [batch] = await db.select().from(batches).where(eq(batches.id, input.batchId)).limit(1);
  if (!batch) throw new Error("BATCH_NOT_FOUND");

  const movementItems = await db
    .select()
    .from(movements)
    .where(eq(movements.batchId, input.batchId));
  const defaultLocationId = await getDefaultLocationId(db);
  const { fromLocationId, toLocationId } = normalizeMovementLocations(input, defaultLocationId);

  if (fromLocationId) {
    const stockWithoutCurrentMovement = calculateBatchStock(
      batch,
      movementItems.filter((movement) => movement.id !== input.id),
    );
    const available = stockWithoutCurrentMovement.get(fromLocationId) ?? 0;
    if (available + 0.0001 < input.quantity) throw new Error("INSUFFICIENT_STOCK");
  }

  const [movement] = await db
    .update(movements)
    .set({
      date: dateValue(input.date),
      fromLocationId,
      toLocationId,
      quantity: numericValue(input.quantity),
      totalPrice: input.type === "STOCK_IN" ? numericValue(input.totalPrice ?? 0) : null,
      remark: input.remark,
    })
    .where(and(eq(movements.id, input.id), eq(movements.batchId, input.batchId), eq(movements.type, input.type)))
    .returning();

  await refreshBatchStatus(input.batchId);
  return movement;
}

export async function getMaterialHomeData() {
  const summary = await getInventorySummary();
  const locationStocks = summary.byLocation
    .filter((location) => location.locationType === "warehouse");
  const lowStockAlerts = locationStocks
    .flatMap((location) =>
      location.items
        .filter((item) => item.status === "active" && item.activeStock <= 50)
        .map((item) => ({
          locationId: location.locationId,
          locationName: location.locationName,
          materialId: item.materialId,
          materialName: item.materialName,
          stock: item.activeStock,
          status: item.status,
        })),
    )
    .sort((a, b) => {
      const aZero = Math.abs(a.stock) <= 0.0001;
      const bZero = Math.abs(b.stock) <= 0.0001;
      if (aZero !== bZero) return aZero ? -1 : 1;
      return a.stock - b.stock || a.materialName.localeCompare(b.materialName, "zh-Hans-CN");
    });

  return {
    locationStocks,
    lowStockAlerts,
    batchCount: summary.byBatch.length,
    totalStock: summary.byLocation.reduce((sum, location) => sum + location.totalStock, 0),
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

  console.log("dashboard: loading counts");
  const [
    pendingCount,
    todayReminderCount,
    completedCount,
    highPriorityCount,
    fixedCount,
    memoCount,
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
  ]);
  console.log("dashboard: loaded counts");

  console.log("dashboard: loading previews");
  const [
    upcomingTasks,
    pinnedFixed,
    reminderPreview,
    recentMemos,
  ] = await Promise.all([
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
  ]);
  console.log("dashboard: loaded previews");

  console.log("dashboard: loading inventory summary");
  const locationStockPreview = await getInventorySummary()
    .then((inventorySummary) => {
      const preview = inventorySummary.byLocation
        .filter((location) => location.locationType === "warehouse" && Math.abs(location.totalStock) > 0.0001)
        .slice(0, 5);
      console.log("dashboard: loaded inventory summary", { warehouseCount: preview.length });
      return preview;
    })
    .catch((error) => {
      console.error("dashboard: inventory summary failed", error);
      return [];
    });

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
    locationStockPreview,
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
