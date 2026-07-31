import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";

import {
  fixedItems,
  bomItems,
  inventoryLinkGroupItems,
  inventoryLinkGroups,
  materialLocationStates,
  materialCategories,
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
  type BomItem,
  type FixedItem,
  type InventoryLinkScope,
  type InventoryLinkTargetType,
  type Location as DbLocation,
  type LocationType,
  type Memo,
  type Material,
  type MaterialLocationStatus,
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
  category?: string;
  status?: BatchStatus | "all";
  supplier?: string;
};

type BomInventoryFilters = {
  materialName?: string;
  supplier?: string;
};

type MaterialFilters = {
  sort?: string;
  search?: string;
  category?: string;
  warehouse?: string;
  status?: MaterialLocationStatus | "all" | "alert";
  alert?: string;
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
    status: InventoryReplenishState;
  }>;
  movements: Movement[];
};

type InventoryReplenishState = MaterialLocationStatus;

type InventoryLocationItemSummary = {
  materialId: string;
  materialName: string;
  category: string;
  stock: number;
  status: InventoryReplenishState;
  activeStock: number;
};

type InventoryLocationDetailRow = {
  batchId: string;
  batchCode: string;
  materialId: string;
  materialName: string;
  category: string;
  quantity: number;
  status: InventoryReplenishState;
  sourceText: string;
};

type MaterialSummary = {
  id: string;
  name: string;
  category: string;
  type: string;
  size: string;
  unit: string;
  remark: string;
  createdAt: Date;
  currentStock: number;
  latestUsedAt: string | Date | null;
  locations: Array<{
    locationId: string;
    locationName: string;
    stock: number;
    status: InventoryReplenishState;
    activeStock: number;
  }>;
};

type BomInventoryChild = {
  bomId: string;
  materialId: string;
  materialName: string;
  category: string;
  unit: string;
  quantityPerParent: number;
  totalStock: number;
  activeStock: number;
  locations: Array<{
    locationId: string;
    locationName: string;
    stock: number;
    activeStock: number;
    status: InventoryReplenishState;
  }>;
  relatedBatches: InventoryBatchSummary[];
};

type BomInventoryGroup = {
  parent: Material;
  children: BomInventoryChild[];
  availableQuantity: number;
  totalChildStock: number;
  matchedBy: "parent" | "child" | "all";
};

function compact<T>(items: Array<T | undefined | null | false>) {
  return items.filter(Boolean) as T[];
}

function searchValue(value?: string) {
  const clean = value?.trim();
  return clean ? `%${clean}%` : null;
}

export function inferMaterialCategory(name: string) {
  if (name.includes("彩盒")) return "彩盒";
  if (name.includes("贺卡")) return "贺卡";
  if (name.includes("标签")) return "标签类";
  return "未分类";
}

function materialCategory(input: { name: string; category?: string | null }) {
  const manualCategory = input.category?.trim();
  return manualCategory || inferMaterialCategory(input.name.trim());
}

function normalizeSearch(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function includesSearch(value: string | null | undefined, query: string) {
  return Boolean(query) && String(value ?? "").toLowerCase().includes(query);
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

function deriveLocationMaterialStatus(
  configuredStatus: InventoryReplenishState | undefined,
  stock: number,
) {
  if (configuredStatus) return configuredStatus;
  return stock <= 0 ? "used_up" : "active";
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
  const [locationItems, batchRows, movementItems, locationStateItems] = await Promise.all([
    listLocations(),
    db
      .select({ batch: batches, material: materials, initialLocation: locations })
      .from(batches)
      .innerJoin(materials, eq(batches.materialId, materials.id))
      .innerJoin(locations, eq(batches.initialLocationId, locations.id))
      .orderBy(desc(batches.productionDate), desc(batches.createdAt)),
    db.select().from(movements),
    db.select().from(materialLocationStates),
  ]);

  const movementMap = new Map<string, Movement[]>();

  for (const movement of movementItems) {
    const batchMovements = movementMap.get(movement.batchId) ?? [];
    batchMovements.push(movement);
    movementMap.set(movement.batchId, batchMovements);
  }

  const locationById = new Map(locationItems.map((location) => [location.id, location]));
  const locationStateMap = new Map(
    locationStateItems.map((item) => [`${item.materialId}:${item.locationId}`, item.status]),
  );

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
  const materialSummaryMap = new Map<string, MaterialSummary>();
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
      .map((location) => {
        const quantity = detailStock.get(location.id) ?? 0;
        return {
          location,
          quantity,
          status: deriveLocationMaterialStatus(
            locationStateMap.get(`${row.material.id}:${location.id}`),
            quantity,
          ),
        };
      });
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
        materialEntry.category = row.material.category || materialEntry.category;
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
        category: row.material.category,
        type: row.material.type,
        size: row.material.size,
        unit: row.material.unit,
        remark: row.material.remark,
        createdAt: row.material.createdAt,
        currentStock: currentRemaining,
        latestUsedAt: latestMovement?.date ?? null,
        locations: [],
      });
    }

    for (const { location, quantity, status } of stockDistribution) {
      if (!location) continue;

      const summary = summaryMap.get(location.id);
      if (!summary) continue;

      summary.totalStock += quantity;

      const existingItem = summary.itemMap.get(materialName);
      if (existingItem) {
        existingItem.stock += quantity;
        existingItem.status = mergeInventoryStatus(existingItem.status, status);
        if (status === "active") {
          existingItem.activeStock += quantity;
        }
      } else {
        summary.itemMap.set(materialName, {
          materialId: row.material.id,
          materialName,
          category: row.material.category,
          stock: quantity,
          status,
          activeStock: status === "active" ? quantity : 0,
        });
      }

      const locationMaterialEntry = materialSummaryMap.get(materialName);
      if (locationMaterialEntry) {
        const existingLocation = locationMaterialEntry.locations.find((item) => item.locationId === location.id);
        if (existingLocation) {
          existingLocation.stock += quantity;
          existingLocation.status = mergeInventoryStatus(existingLocation.status, status);
          if (status === "active") existingLocation.activeStock += quantity;
        } else {
          locationMaterialEntry.locations.push({
            locationId: location.id,
            locationName: location.name,
            stock: quantity,
            status,
            activeStock: status === "active" ? quantity : 0,
          });
        }
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
        category: row.material.category,
        quantity,
        status,
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

  const byMaterial = [...materialSummaryMap.values()].map((item) => ({
    ...item,
    locations: item.locations
      .filter((location) => Math.abs(location.stock) > 0.0001 || location.status !== "used_up")
      .sort((a, b) => b.stock - a.stock || a.locationName.localeCompare(b.locationName, "zh-Hans-CN")),
  }));

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

export async function setMaterialLocationStatus(input: {
  materialId: string;
  locationId: string;
  status: MaterialLocationStatus;
}) {
  const db = await getDb();
  const [state] = await db
    .insert(materialLocationStates)
    .values({
      materialId: input.materialId,
      locationId: input.locationId,
      status: input.status,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [materialLocationStates.materialId, materialLocationStates.locationId],
      set: { status: input.status, updatedAt: new Date() },
    })
    .returning();
  return state;
}

export async function setMaterialStatusForAllWarehouses(materialId: string, status: MaterialLocationStatus) {
  const summary = await getInventorySummary();
  const material = summary.byMaterial.find((item) => item.id === materialId);
  await Promise.all(
    (material?.locations ?? []).map((location) =>
      setMaterialLocationStatus({ materialId, locationId: location.locationId, status }),
    ),
  );
}

export async function listBomItems(parentMaterialId: string) {
  const db = await getDb();
  return db
    .select({
      bom: bomItems,
      child: materials,
    })
    .from(bomItems)
    .innerJoin(materials, eq(bomItems.childMaterialId, materials.id))
    .where(eq(bomItems.parentMaterialId, parentMaterialId))
    .orderBy(asc(materials.category), asc(materials.name));
}

export async function upsertBomItem(input: {
  id?: string;
  parentMaterialId: string;
  childMaterialId: string;
  quantity: number;
}) {
  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
  const db = await getDb();
  if (input.id) {
    const [item] = await db
      .update(bomItems)
      .set({
        childMaterialId: input.childMaterialId,
        quantity: numericValue(input.quantity),
      })
      .where(and(eq(bomItems.id, input.id), eq(bomItems.parentMaterialId, input.parentMaterialId)))
      .returning();
    return item;
  }

  const [item] = await db
    .insert(bomItems)
    .values({
      parentMaterialId: input.parentMaterialId,
      childMaterialId: input.childMaterialId,
      quantity: numericValue(input.quantity),
    })
    .onConflictDoUpdate({
      target: [bomItems.parentMaterialId, bomItems.childMaterialId],
      set: { quantity: numericValue(input.quantity) },
    })
    .returning();
  return item;
}

export async function deleteBomItem(id: string, parentMaterialId: string) {
  const db = await getDb();
  await db.delete(bomItems).where(and(eq(bomItems.id, id), eq(bomItems.parentMaterialId, parentMaterialId)));
}

async function listBomRowsWithMaterials() {
  const db = await getDb();
  const [bomRows, materialItems] = await Promise.all([
    db.select().from(bomItems),
    db.select().from(materials),
  ]);
  const materialById = new Map(materialItems.map((material) => [material.id, material]));

  return bomRows
    .map((bom) => ({
      bom,
      parent: materialById.get(bom.parentMaterialId) ?? null,
      child: materialById.get(bom.childMaterialId) ?? null,
    }))
    .filter((row): row is {
      bom: BomItem;
      parent: Material;
      child: Material;
    } => Boolean(row.parent && row.child));
}

function bomMatchesSearch(row: { parent: Material; child: Material }, query: string) {
  if (!query) return "all";
  if (includesSearch(row.parent.name, query) || includesSearch(row.parent.category, query)) return "parent";
  if (includesSearch(row.child.name, query) || includesSearch(row.child.category, query)) return "child";
  return null;
}

export async function getBomInventoryGroups(filters: BomInventoryFilters = {}) {
  const [summary, bomRows] = await Promise.all([buildInventorySummary(), listBomRowsWithMaterials()]);
  const query = normalizeSearch(filters.materialName);
  const warehouseQuery = normalizeSearch(filters.supplier);
  const materialSummaryById = new Map(summary.byMaterial.map((material) => [material.id, material]));
  const batchRowsByMaterialId = new Map<string, InventoryBatchSummary[]>();

  for (const row of summary.byBatch) {
    const rows = batchRowsByMaterialId.get(row.batch.materialId) ?? [];
    rows.push(row);
    batchRowsByMaterialId.set(row.batch.materialId, rows);
  }

  const groupMap = new Map<string, BomInventoryGroup>();
  for (const row of bomRows) {
    const matchedBy = bomMatchesSearch(row, query);
    if (query && !matchedBy) continue;

    const childSummary = materialSummaryById.get(row.child.id);
    const childLocations = (childSummary?.locations ?? [])
      .filter((location) => (warehouseQuery ? includesSearch(location.locationName, warehouseQuery) : true));
    if (warehouseQuery && !childLocations.length) continue;

    const quantityPerParent = numberValue(row.bom.quantity);
    const activeStock = childLocations.reduce((sum, location) => sum + location.activeStock, 0);
    const child: BomInventoryChild = {
      bomId: row.bom.id,
      materialId: row.child.id,
      materialName: row.child.name,
      category: row.child.category,
      unit: row.child.unit,
      quantityPerParent,
      totalStock: childLocations.reduce((sum, location) => sum + location.stock, 0),
      activeStock,
      locations: childLocations,
      relatedBatches: batchRowsByMaterialId.get(row.child.id) ?? [],
    };

    const existing = groupMap.get(row.parent.id);
    if (existing) {
      existing.children.push(child);
      existing.totalChildStock += child.totalStock;
      existing.availableQuantity = Math.min(
        existing.availableQuantity,
        quantityPerParent > 0 ? Math.floor(activeStock / quantityPerParent) : 0,
      );
      if (matchedBy === "parent") existing.matchedBy = "parent";
      else if (existing.matchedBy !== "parent" && matchedBy === "child") existing.matchedBy = "child";
    } else {
      groupMap.set(row.parent.id, {
        parent: row.parent,
        children: [child],
        availableQuantity: quantityPerParent > 0 ? Math.floor(activeStock / quantityPerParent) : 0,
        totalChildStock: child.totalStock,
        matchedBy: matchedBy ?? "all",
      });
    }
  }

  return [...groupMap.values()]
    .filter((group) => group.children.length > 0)
    .sort((a, b) => a.parent.name.localeCompare(b.parent.name, "zh-Hans-CN"));
}

export async function listMaterials(filters: MaterialFilters = {}) {
  const summary = await buildInventorySummary();
  const search = filters.search?.trim().toLowerCase();
  const items = [...summary.byMaterial].filter((item) => {
    if (filters.category && filters.category !== "all" && item.category !== filters.category) return false;
    if (filters.warehouse && filters.warehouse !== "all") {
      if (!item.locations.some((location) => location.locationId === filters.warehouse)) return false;
    }
    if (filters.status && filters.status !== "all" && filters.status !== "alert") {
      if (!item.locations.some((location) => location.status === filters.status)) return false;
    }
    if ((filters.status === "alert" || filters.alert === "1") && !item.locations.some((location) => (
      location.status === "active" && location.activeStock <= 50
    ))) {
      return false;
    }
    if (search) {
      const haystack = [
        item.category,
        item.name,
        ...item.locations.map((location) => location.locationName),
      ].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });

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
  const values = {
    ...input,
    name: input.name.trim(),
    category: materialCategory(input),
  };
  if (id) {
    const [material] = await db
      .update(materials)
      .set(values)
      .where(eq(materials.id, id))
      .returning();
    return material;
  }

  const [material] = await db.insert(materials).values(values).returning();
  return material;
}

export async function listMaterialCategories() {
  const items = await listMaterialCategoryItems();
  return items.map((item) => item.name);
}

export async function listMaterialCategoryItems() {
  const db = await getDb();
  const rows = await db
    .select()
    .from(materialCategories)
    .orderBy(asc(materialCategories.sortOrder), asc(materialCategories.name));
  return rows;
}

export async function upsertMaterialCategory(input: {
  name: string;
  sortOrder: number;
}, id?: string) {
  const db = await getDb();
  const values = {
    name: input.name.trim(),
    sortOrder: Number.isFinite(input.sortOrder) ? input.sortOrder : 0,
  };
  if (!values.name) throw new Error("CATEGORY_NAME_REQUIRED");

  if (id) {
    const [category] = await db
      .update(materialCategories)
      .set(values)
      .where(eq(materialCategories.id, id))
      .returning();
    return category;
  }

  const [category] = await db
    .insert(materialCategories)
    .values(values)
    .onConflictDoUpdate({
      target: materialCategories.name,
      set: { sortOrder: values.sortOrder },
    })
    .returning();
  return category;
}

export async function deleteMaterialCategory(id: string) {
  const db = await getDb();
  const [category] = await db
    .select()
    .from(materialCategories)
    .where(eq(materialCategories.id, id))
    .limit(1);
  if (!category) return;

  await db
    .update(materials)
    .set({ category: "未分类" })
    .where(eq(materials.category, category.name));
  await db.delete(materialCategories).where(eq(materialCategories.id, id));
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
  category?: string;
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
      .values({ ...input, name, category: materialCategory({ name, category: input.category }) })
      .returning();
    return material;
  }

  const next = {
    name,
    category: materialCategory({ name, category: input.category || existing.category }),
    type: input.type.trim() || existing.type,
    size: input.size.trim() || existing.size,
    unit: input.unit.trim() || existing.unit,
    remark: input.remark.trim() || existing.remark,
  };

  if (
    next.category === existing.category &&
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
  const [summary, bomRows] = await Promise.all([buildInventorySummary(), listBomRowsWithMaterials()]);
  const materialQuery = normalizeSearch(filters.materialName);
  const supplierQuery = normalizeSearch(filters.supplier);
  const bomRelatedMaterialIds = new Set<string>();

  if (materialQuery) {
    for (const row of bomRows) {
      if (bomMatchesSearch(row, materialQuery)) {
        bomRelatedMaterialIds.add(row.parent.id);
        bomRelatedMaterialIds.add(row.child.id);
      }
    }
  }

  return summary.byBatch.filter((row) => {
    if (filters.date && String(row.batch.productionDate) !== filters.date) return false;
    if (filters.materialId && row.batch.materialId !== filters.materialId) return false;
    if (filters.category && filters.category !== "all" && row.material.category !== filters.category) return false;
    if (materialQuery) {
      const materialMatch = [
        row.material.name,
        row.material.category,
        row.batch.batchCode,
        row.batch.supplier,
        row.initialLocation.name,
        ...row.stockDistribution.map((stock) => stock.location.name),
      ].some((value) => includesSearch(value, materialQuery));
      if (!materialMatch && !bomRelatedMaterialIds.has(row.batch.materialId)) return false;
    }
    if (filters.status && filters.status !== "all" && row.batch.status !== filters.status) return false;
    if (supplierQuery) {
      const supplierMatch = [
        row.batch.supplier,
        row.initialLocation.name,
        ...row.stockDistribution.map((stock) => stock.location.name),
      ].some((value) => includesSearch(value, supplierQuery));
      if (!supplierMatch) return false;
    }
    return true;
  });
}

function filterBatchesByIds(items: InventoryBatchSummary[], ids: Set<string>) {
  if (!ids.size) return items;
  return items.filter((row) => ids.has(row.batch.id));
}

function batchIdsForBomGroups(groups: BomInventoryGroup[]) {
  return new Set(groups.flatMap((group) =>
    group.children.flatMap((child) => child.relatedBatches.map((row) => row.batch.id)),
  ));
}

export async function listBatchesWithBomMatches(filters: BatchFilters = {}) {
  const [batchesResult, bomGroups] = await Promise.all([
    listBatches(filters),
    getBomInventoryGroups({ materialName: filters.materialName, supplier: filters.supplier }),
  ]);

  if (!filters.materialName?.trim()) {
    return { batches: batchesResult, bomGroups };
  }

  const relatedBatchIds = batchIdsForBomGroups(bomGroups);
  return {
    batches: filterBatchesByIds(batchesResult, relatedBatchIds.size ? relatedBatchIds : new Set()),
    bomGroups,
  };
}

export type InventoryLinkGroupDetail = Awaited<ReturnType<typeof listInventoryLinkGroups>>[number];

function normalizeInventoryLinkScope(scope?: string | null): InventoryLinkScope {
  return scope === "batch" ? "batch" : "material";
}

function normalizeInventoryLinkTargetType(type?: string | null): InventoryLinkTargetType {
  return type === "batch" ? "batch" : "material";
}

export async function listInventoryLinkGroups() {
  const [db, summary] = await Promise.all([getDb(), getInventorySummary()]);
  const rows = await db
    .select({
      group: inventoryLinkGroups,
      item: inventoryLinkGroupItems,
      material: materials,
      batch: batches,
    })
    .from(inventoryLinkGroups)
    .leftJoin(inventoryLinkGroupItems, eq(inventoryLinkGroups.id, inventoryLinkGroupItems.groupId))
    .leftJoin(materials, eq(inventoryLinkGroupItems.materialId, materials.id))
    .leftJoin(batches, eq(inventoryLinkGroupItems.batchId, batches.id))
    .orderBy(desc(inventoryLinkGroups.createdAt), asc(inventoryLinkGroupItems.sortOrder));

  const batchMaterialIds = rows
    .map((row) => row.batch?.materialId)
    .filter((id): id is string => Boolean(id));
  const batchMaterialRows = batchMaterialIds.length
    ? await db.select().from(materials).where(inArray(materials.id, batchMaterialIds))
    : [];
  const batchMaterialById = new Map(batchMaterialRows.map((material) => [material.id, material]));
  const groupMap = new Map<string, {
    id: string;
    name: string;
    scope: InventoryLinkScope;
    createdAt: Date;
    items: Array<{
      id: string;
      targetType: InventoryLinkTargetType;
      targetId: string;
      materialId: string;
      batchId: string | null;
      name: string;
      batchCode: string | null;
      category: string;
      unit: string;
      defaultEnabled: boolean;
      activeStock: number;
      locations: Array<{ locationId: string; locationName: string; stock: number; status: MaterialLocationStatus }>;
      batches: Array<{
        id: string;
        batchCode: string;
        productionDate: string;
        status: BatchStatus;
        currentRemaining: number;
      }>;
    }>;
  }>();

  for (const row of rows) {
    const scope = normalizeInventoryLinkScope(row.group.scope);
    const group = groupMap.get(row.group.id) ?? {
      id: row.group.id,
      name: row.group.name,
      scope,
      createdAt: row.group.createdAt,
      items: [],
    };
    groupMap.set(row.group.id, group);

    if (!row.item) continue;
    const targetType = normalizeInventoryLinkTargetType(row.item.targetType);
    const material = targetType === "batch" && row.batch
      ? batchMaterialById.get(row.batch.materialId)
      : row.material;
    if (!material) continue;

    const batchSummary = row.batch
      ? summary.byBatch.find((batchRow) => batchRow.batch.id === row.batch?.id)
      : null;
    const materialSummary = summary.byMaterial.find((item) => item.id === material.id);
    const locationsForItem = batchSummary
      ? batchSummary.stockDistribution.map((stock) => ({
        locationId: stock.location.id,
        locationName: stock.location.name,
        stock: stock.quantity,
        status: stock.status,
      }))
      : materialSummary?.locations.map((location) => ({
        locationId: location.locationId,
        locationName: location.locationName,
        stock: location.stock,
        status: location.status,
      })) ?? [];
    const batchesForItem = summary.byBatch
      .filter((batchRow) => batchRow.batch.materialId === material.id)
      .map((batchRow) => ({
        id: batchRow.batch.id,
        batchCode: batchRow.batch.batchCode,
        productionDate: String(batchRow.batch.productionDate),
        status: batchRow.batch.status,
        currentRemaining: batchRow.currentRemaining,
      }))
      .sort((a, b) => {
        const activeSort = Number(b.status === "active") - Number(a.status === "active");
        if (activeSort !== 0) return activeSort;
        return b.productionDate.localeCompare(a.productionDate);
      });

    group.items.push({
      id: row.item.id,
      targetType,
      targetId: targetType === "batch" ? row.item.batchId ?? "" : material.id,
      materialId: material.id,
      batchId: row.item.batchId,
      name: material.name,
      batchCode: row.batch?.batchCode ?? null,
      category: material.category,
      unit: material.unit,
      defaultEnabled: row.item.defaultEnabled,
      activeStock: locationsForItem.reduce((sum, location) => (
        sum + (location.status === "active" ? location.stock : 0)
      ), 0),
      locations: locationsForItem,
      batches: batchesForItem,
    });
  }

  return [...groupMap.values()];
}

export async function getInventoryLinkGroupDetail(id?: string | null) {
  if (!id) return null;
  const groups = await listInventoryLinkGroups();
  return groups.find((group) => group.id === id) ?? null;
}

export async function listInventoryLinkGroupsForBatch(batchId?: string | null) {
  if (!batchId) return [];
  const detail = await getBatchDetail(batchId);
  if (!detail) return [];
  const groups = await listInventoryLinkGroups();
  return groups.filter((group) => group.items.some((item) => (
    item.batchId === batchId || item.materialId === detail.material.id
  )));
}

export async function getInventoryLinkBadgesForBatches(batchRows: InventoryBatchSummary[]) {
  const groups = await listInventoryLinkGroups();
  const map = new Map<string, InventoryLinkGroupDetail[]>();

  for (const row of batchRows) {
    const matched = groups.filter((group) => group.items.some((item) => (
      item.batchId === row.batch.id || item.materialId === row.material.id
    )));
    if (matched.length) map.set(row.batch.id, matched);
  }
  return map;
}

export async function upsertInventoryLinkGroup(input: {
  id?: string;
  name: string;
  scope: InventoryLinkScope;
}) {
  const db = await getDb();
  const values = {
    name: input.name.trim(),
    scope: normalizeInventoryLinkScope(input.scope),
  };
  if (!values.name) throw new Error("GROUP_NAME_REQUIRED");

  if (input.id) {
    const [group] = await db
      .update(inventoryLinkGroups)
      .set(values)
      .where(eq(inventoryLinkGroups.id, input.id))
      .returning();
    return group;
  }

  const [group] = await db.insert(inventoryLinkGroups).values(values).returning();
  return group;
}

export async function addInventoryLinkGroupItem(input: {
  groupId: string;
  targetType: InventoryLinkTargetType;
  materialId?: string | null;
  batchId?: string | null;
}) {
  const db = await getDb();
  const [group] = await db
    .select()
    .from(inventoryLinkGroups)
    .where(eq(inventoryLinkGroups.id, input.groupId))
    .limit(1);
  if (!group) throw new Error("GROUP_NOT_FOUND");

  const targetType = normalizeInventoryLinkTargetType(input.targetType);
  if (normalizeInventoryLinkScope(group.scope) !== targetType) throw new Error("GROUP_SCOPE_MISMATCH");

  let materialId = input.materialId || null;
  let batchId = input.batchId || null;
  if (targetType === "batch") {
    if (!batchId) throw new Error("BATCH_REQUIRED");
    const [batch] = await db.select().from(batches).where(eq(batches.id, batchId)).limit(1);
    if (!batch) throw new Error("BATCH_NOT_FOUND");
    materialId = batch.materialId;
  } else {
    batchId = null;
    if (!materialId) throw new Error("MATERIAL_REQUIRED");
  }

  const [{ value }] = await db
    .select({ value: count() })
    .from(inventoryLinkGroupItems)
    .where(eq(inventoryLinkGroupItems.groupId, input.groupId));

  const [item] = await db
    .insert(inventoryLinkGroupItems)
    .values({
      groupId: input.groupId,
      targetType,
      materialId,
      batchId,
      sortOrder: value,
      defaultEnabled: true,
    })
    .onConflictDoNothing()
    .returning();
  return item ?? null;
}

export async function removeInventoryLinkGroupItem(id: string) {
  const db = await getDb();
  await db.delete(inventoryLinkGroupItems).where(eq(inventoryLinkGroupItems.id, id));
}

export async function createLinkedTransfer(input: {
  groupId: string;
  fromLocationId: string;
  toLocationId: string;
  date: string;
  remark: string;
  items: Array<{
    targetId: string;
    targetType: InventoryLinkTargetType;
    enabled: boolean;
    quantity: number;
  }>;
}) {
  if (!input.fromLocationId || !input.toLocationId) throw new Error("LOCATION_REQUIRED");
  if (input.fromLocationId === input.toLocationId) throw new Error("SAME_LOCATION");

  const group = await getInventoryLinkGroupDetail(input.groupId);
  if (!group) throw new Error("GROUP_NOT_FOUND");

  const enabledItems = input.items
    .filter((item) => item.enabled && item.quantity > 0)
    .map((item) => ({
      ...item,
      targetType: normalizeInventoryLinkTargetType(item.targetType),
    }));
  if (!enabledItems.length) throw new Error("NO_ITEMS");

  const summary = await getInventorySummary();
  for (const item of enabledItems) {
    const groupItem = group.items.find((row) => row.targetId === item.targetId && row.targetType === item.targetType);
    if (!groupItem) throw new Error("ITEM_NOT_IN_GROUP");
    const available = item.targetType === "batch"
      ? summary.byBatch
        .find((row) => row.batch.id === item.targetId)
        ?.stockDistribution.find((stock) => (
          stock.location.id === input.fromLocationId && stock.status === "active"
        ))?.quantity ?? 0
      : summary.byBatch
        .filter((row) => row.batch.materialId === item.targetId)
        .reduce((sum, row) => (
          sum + (row.stockDistribution.find((stock) => (
            stock.location.id === input.fromLocationId && stock.status === "active"
          ))?.quantity ?? 0)
        ), 0);
    if (available + 0.0001 < item.quantity) throw new Error("INSUFFICIENT_STOCK");
  }

  for (const item of enabledItems) {
    if (item.targetType === "batch") {
      await createMovement({
        batchId: item.targetId,
        date: input.date,
        type: "TRANSFER",
        fromLocationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        quantity: item.quantity,
        remark: input.remark || `联动组调货：${group.name}`,
      });
    } else {
      await createMaterialMovement({
        materialId: item.targetId,
        locationId: input.fromLocationId,
        toLocationId: input.toLocationId,
        quantity: item.quantity,
        type: "TRANSFER",
        remark: input.remark || `联动组调货：${group.name}`,
        date: input.date,
      });
    }
  }
}

export async function createLinkedStockIn(input: {
  groupId: string;
  toLocationId: string;
  date: string;
  remark: string;
  items: Array<{
    targetId: string;
    targetType: InventoryLinkTargetType;
    batchId?: string | null;
    enabled: boolean;
    quantity: number;
    totalPrice: number;
  }>;
}) {
  if (!input.toLocationId) throw new Error("LOCATION_REQUIRED");

  const group = await getInventoryLinkGroupDetail(input.groupId);
  if (!group) throw new Error("GROUP_NOT_FOUND");

  const enabledItems = input.items
    .filter((item) => item.enabled)
    .map((item) => ({
      ...item,
      targetType: normalizeInventoryLinkTargetType(item.targetType),
      batchId: item.targetType === "batch" ? item.targetId : item.batchId,
    }));
  if (!enabledItems.length) throw new Error("NO_ITEMS");

  for (const item of enabledItems) {
    if (item.quantity <= 0) throw new Error("INVALID_QUANTITY");
    if (item.totalPrice < 0) throw new Error("INVALID_PRICE");
    if (!item.batchId) throw new Error("BATCH_REQUIRED");
  }

  const db = await getDb();
  const selectedBatchIds = [...new Set(enabledItems.map((item) => item.batchId).filter((id): id is string => Boolean(id)))];
  const batchRows = selectedBatchIds.length
    ? await db.select().from(batches).where(inArray(batches.id, selectedBatchIds))
    : [];
  const batchById = new Map(batchRows.map((batch) => [batch.id, batch]));

  for (const item of enabledItems) {
    const groupItem = group.items.find((row) => (
      row.targetId === item.targetId && row.targetType === item.targetType
    ));
    if (!groupItem) throw new Error("ITEM_NOT_IN_GROUP");
    const batch = item.batchId ? batchById.get(item.batchId) : null;
    if (!batch) throw new Error("BATCH_NOT_FOUND");
    if (batch.materialId !== groupItem.materialId) throw new Error("BATCH_MATERIAL_MISMATCH");
  }

  for (const item of enabledItems) {
    await createMovement({
      batchId: item.batchId ?? "",
      date: input.date,
      type: "STOCK_IN",
      toLocationId: input.toLocationId,
      quantity: item.quantity,
      totalPrice: item.totalPrice,
      remark: input.remark || `联动组入库：${group.name}`,
    });
  }
}

export async function createLinkedStockOut(input: {
  groupId: string;
  fromLocationId: string;
  date: string;
  remark: string;
  operation: "consume" | "return";
  items: Array<{
    targetId: string;
    targetType: InventoryLinkTargetType;
    enabled: boolean;
    quantity: number;
  }>;
}) {
  if (!input.fromLocationId) throw new Error("LOCATION_REQUIRED");

  const group = await getInventoryLinkGroupDetail(input.groupId);
  if (!group) throw new Error("GROUP_NOT_FOUND");

  const enabledItems = input.items
    .filter((item) => item.enabled && item.quantity > 0)
    .map((item) => ({
      ...item,
      targetType: normalizeInventoryLinkTargetType(item.targetType),
    }));
  if (!enabledItems.length) throw new Error("NO_ITEMS");

  const summary = await getInventorySummary();
  for (const item of enabledItems) {
    const groupItem = group.items.find((row) => row.targetId === item.targetId && row.targetType === item.targetType);
    if (!groupItem) throw new Error("ITEM_NOT_IN_GROUP");
    const available = item.targetType === "batch"
      ? summary.byBatch
        .find((row) => row.batch.id === item.targetId)
        ?.stockDistribution.find((stock) => (
          stock.location.id === input.fromLocationId && stock.status === "active"
        ))?.quantity ?? 0
      : summary.byBatch
        .filter((row) => row.batch.materialId === item.targetId)
        .reduce((sum, row) => (
          sum + (row.stockDistribution.find((stock) => (
            stock.location.id === input.fromLocationId && stock.status === "active"
          ))?.quantity ?? 0)
        ), 0);
    if (available + 0.0001 < item.quantity) throw new Error("INSUFFICIENT_STOCK");
  }

  const movementType = input.operation === "return" ? "RETURN" : "CONSUME";
  const remarkPrefix = input.operation === "return" ? "联动组退回" : "联动组扣减";
  for (const item of enabledItems) {
    if (item.targetType === "batch") {
      await createMovement({
        batchId: item.targetId,
        date: input.date,
        type: movementType,
        fromLocationId: input.fromLocationId,
        quantity: item.quantity,
        remark: input.remark || `${remarkPrefix}：${group.name}`,
      });
    } else {
      await createMaterialMovement({
        materialId: item.targetId,
        locationId: input.fromLocationId,
        quantity: item.quantity,
        type: movementType,
        remark: input.remark || `${remarkPrefix}：${group.name}`,
        date: input.date,
      });
    }
  }
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
  materialCategory?: string;
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
    category: input.materialCategory,
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
    materialCategory?: string;
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
    category: input.materialCategory,
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
  await db.delete(inventoryLinkGroupItems).where(eq(inventoryLinkGroupItems.batchId, id));
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

async function createMaterialMovement(input: {
  materialId: string;
  locationId: string;
  toLocationId?: string | null;
  quantity: number;
  type: "CONSUME" | "TRANSFER" | "RETURN";
  remark: string;
  date?: string;
}) {
  const summary = await getInventorySummary();
  const batchesForMaterial = summary.byBatch
    .filter((row) => row.batch.materialId === input.materialId)
    .map((row) => ({
      row,
      stock: row.stockDistribution.find((item) => (
        item.location.id === input.locationId && item.status === "active"
      ))?.quantity ?? 0,
    }))
    .filter((item) => item.stock > 0)
    .sort((a, b) => String(a.row.batch.productionDate).localeCompare(String(b.row.batch.productionDate)));

  let remaining = input.quantity;
  for (const item of batchesForMaterial) {
    if (remaining <= 0.0001) break;
    const quantity = Math.min(remaining, item.stock);
    await createMovement({
      batchId: item.row.batch.id,
      date: input.date || getShanghaiDateString(),
      type: input.type,
      fromLocationId: input.locationId,
      toLocationId: input.type === "TRANSFER" ? input.toLocationId : null,
      quantity,
      remark: input.remark,
    });
    remaining -= quantity;
  }

  if (remaining > 0.0001) throw new Error("INSUFFICIENT_STOCK");
}

export async function operateBom(input: {
  parentMaterialId: string;
  locationId: string;
  toLocationId?: string | null;
  quantity: number;
  operation: "consume" | "transfer" | "inactive";
}) {
  const bomRows = await listBomItems(input.parentMaterialId);
  if (!bomRows.length) throw new Error("BOM_EMPTY");

  if (input.operation === "inactive") {
    await Promise.all([
      setMaterialLocationStatus({
        materialId: input.parentMaterialId,
        locationId: input.locationId,
        status: "inactive",
      }),
      ...bomRows.map((row) =>
        setMaterialLocationStatus({
          materialId: row.bom.childMaterialId,
          locationId: input.locationId,
          status: "inactive",
        }),
      ),
    ]);
    return;
  }

  if (input.quantity <= 0) throw new Error("INVALID_QUANTITY");
  if (input.operation === "transfer" && !input.toLocationId) throw new Error("TARGET_REQUIRED");

  const summary = await getInventorySummary();
  for (const row of bomRows) {
    const requiredQuantity = numberValue(row.bom.quantity) * input.quantity;
    const availableQuantity = summary.byBatch
      .filter((batchRow) => batchRow.batch.materialId === row.bom.childMaterialId)
      .reduce((sum, batchRow) => (
        sum + (batchRow.stockDistribution.find((item) => (
          item.location.id === input.locationId && item.status === "active"
        ))?.quantity ?? 0)
      ), 0);
    if (availableQuantity + 0.0001 < requiredQuantity) throw new Error("INSUFFICIENT_STOCK");
  }

  for (const row of bomRows) {
    await createMaterialMovement({
      materialId: row.bom.childMaterialId,
      locationId: input.locationId,
      toLocationId: input.toLocationId,
      quantity: numberValue(row.bom.quantity) * input.quantity,
      type: input.operation === "transfer" ? "TRANSFER" : "CONSUME",
      remark: `BOM ${input.operation === "transfer" ? "一键调拨" : "一键出库"}`,
    });
  }
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
