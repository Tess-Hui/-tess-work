"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type {
  BatchStatus,
  InventoryLinkScope,
  InventoryLinkTargetType,
  LocationType,
  MaterialLocationStatus,
  MovementType,
  Priority,
} from "@/db/schema";
import {
  addInventoryLinkGroupItem,
  createBatch,
  createLinkedTransfer,
  createMovement,
  deleteBomItem,
  completeTask,
  createTask,
  deleteBatch,
  deleteFixedItem,
  deleteLocation,
  deleteMaterialCategory,
  deleteMaterialSize,
  deleteMemo,
  deleteMovement,
  deleteReminder,
  moveTaskToTrash,
  permanentlyDeleteTask,
  reopenTask,
  restoreTask,
  toggleFixedDashboard,
  toggleFixedPinned,
  toggleMemoPinned,
  toggleReminderHandled,
  updateTask,
  updateBatch,
  updateMovement,
  upsertFixedItem,
  upsertInventoryLinkGroup,
  upsertLocation,
  upsertMaterialCategory,
  upsertMaterialSize,
  upsertMemo,
  upsertMaterial,
  upsertReminder,
  listWarehouseLocations,
  operateBom,
  removeInventoryLinkGroupItem,
  setMaterialLocationStatus,
  setMaterialStatusForAllWarehouses,
  upsertBomItem,
} from "@/lib/data";
import { login, logout, requireAuth } from "@/lib/auth";
import { parseDateInput, parseDateTimeInput } from "@/lib/dates";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function priority(formData: FormData) {
  const value = text(formData, "priority");
  return (["high", "medium", "low"].includes(value) ? value : "medium") as Priority;
}

function bool(formData: FormData, key: string) {
  return formData.get(key) === "on" || formData.get(key) === "true";
}

function revalidateApp() {
  [
    "/dashboard",
    "/tasks",
    "/completed",
    "/trash",
    "/fixed",
    "/reminders",
    "/memos",
    "/gantt",
    "/materials",
    "/materials/items",
    "/materials/batches",
    "/materials/categories",
    "/materials/links",
    "/material-sizes",
    "/locations",
    "/export",
  ].forEach((path) => revalidatePath(path));
}

function numberField(formData: FormData, key: string) {
  const value = Number(text(formData, key));
  return Number.isFinite(value) ? value : 0;
}

export async function loginAction(formData: FormData) {
  const ok = await login(text(formData, "username"), text(formData, "password"));
  if (!ok) redirect("/login?error=1");
  redirect("/dashboard");
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}

export async function saveTaskAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const input = {
    content: text(formData, "content"),
    plannedAt: parseDateTimeInput(formData.get("plannedAt")),
    completedAt: parseDateTimeInput(formData.get("completedAt")),
    liaison: text(formData, "liaison"),
    priority: priority(formData),
    notes: text(formData, "notes"),
  };

  if (!input.content) redirect("/tasks?error=content");
  if (id) await updateTask(id, input);
  else await createTask(input);

  revalidateApp();
  redirect(input.completedAt ? "/completed" : "/tasks");
}

export async function completeTaskAction(formData: FormData) {
  await requireAuth();
  await completeTask(text(formData, "id"));
  revalidateApp();
}

export async function reopenTaskAction(formData: FormData) {
  await requireAuth();
  await reopenTask(text(formData, "id"));
  revalidateApp();
}

export async function trashTaskAction(formData: FormData) {
  await requireAuth();
  await moveTaskToTrash(text(formData, "id"));
  revalidateApp();
}

export async function restoreTaskAction(formData: FormData) {
  await requireAuth();
  await restoreTask(text(formData, "id"));
  revalidateApp();
}

export async function permanentDeleteTaskAction(formData: FormData) {
  await requireAuth();
  await permanentlyDeleteTask(text(formData, "id"));
  revalidateApp();
}

export async function saveFixedItemAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (!title) redirect("/fixed?error=title");

  await upsertFixedItem(
    {
      title,
      content: text(formData, "content"),
      category: text(formData, "category") || "General",
      priority: priority(formData),
      pinned: bool(formData, "pinned"),
      showOnDashboard: bool(formData, "showOnDashboard"),
      startDate: parseDateInput(formData.get("startDate")),
      endDate: parseDateInput(formData.get("endDate")),
    },
    id || undefined,
  );

  revalidateApp();
  redirect("/fixed");
}

export async function deleteFixedItemAction(formData: FormData) {
  await requireAuth();
  await deleteFixedItem(text(formData, "id"));
  revalidateApp();
}

export async function toggleFixedPinnedAction(formData: FormData) {
  await requireAuth();
  await toggleFixedPinned(text(formData, "id"), bool(formData, "next"));
  revalidateApp();
}

export async function toggleFixedDashboardAction(formData: FormData) {
  await requireAuth();
  await toggleFixedDashboard(text(formData, "id"), bool(formData, "next"));
  revalidateApp();
}

export async function saveReminderAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const title = text(formData, "title");
  const reminderDate = parseDateInput(formData.get("reminderDate"));
  if (!title || !reminderDate) redirect("/reminders?error=required");

  await upsertReminder(
    {
      title,
      content: text(formData, "content"),
      reminderDate,
      reminderTime: text(formData, "reminderTime"),
      priority: priority(formData),
      handled: bool(formData, "handled"),
    },
    id || undefined,
  );

  revalidateApp();
  redirect("/reminders");
}

export async function deleteReminderAction(formData: FormData) {
  await requireAuth();
  await deleteReminder(text(formData, "id"));
  revalidateApp();
}

export async function toggleReminderHandledAction(formData: FormData) {
  await requireAuth();
  await toggleReminderHandled(text(formData, "id"), bool(formData, "next"));
  revalidateApp();
}

export async function saveMemoAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const title = text(formData, "title");
  if (!title) redirect("/memos?error=title");

  await upsertMemo(
    {
      title,
      content: text(formData, "content"),
      tags: text(formData, "tags"),
      pinned: bool(formData, "pinned"),
    },
    id || undefined,
  );

  revalidateApp();
  redirect("/memos");
}

export async function deleteMemoAction(formData: FormData) {
  await requireAuth();
  await deleteMemo(text(formData, "id"));
  revalidateApp();
}

export async function toggleMemoPinnedAction(formData: FormData) {
  await requireAuth();
  await toggleMemoPinned(text(formData, "id"), bool(formData, "next"));
  revalidateApp();
}

export async function saveMaterialAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/materials/items?error=name");
  await upsertMaterial({
    name,
    type: text(formData, "type"),
    size: text(formData, "size"),
    unit: text(formData, "unit"),
    category: text(formData, "category"),
    remark: text(formData, "remark"),
  }, id || undefined);
  revalidateApp();
  redirect("/materials/items");
}

export async function saveMaterialCategoryAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/materials/categories?error=name");
  try {
    await upsertMaterialCategory({
      name,
      sortOrder: numberField(formData, "sortOrder"),
    }, id || undefined);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/categories?error=${encodeURIComponent(reason)}`);
  }
  revalidateApp();
  redirect("/materials/categories");
}

export async function deleteMaterialCategoryAction(formData: FormData) {
  await requireAuth();
  try {
    await deleteMaterialCategory(text(formData, "id"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/categories?error=${encodeURIComponent(reason)}`);
  }
  revalidateApp();
  redirect("/materials/categories");
}

function materialLocationStatus(formData: FormData) {
  const status = text(formData, "status");
  return (["active", "used_up", "inactive"].includes(status) ? status : "active") as MaterialLocationStatus;
}

function inventoryLinkScope(formData: FormData) {
  const scope = text(formData, "scope");
  return (scope === "batch" ? "batch" : "material") as InventoryLinkScope;
}

function inventoryLinkTargetType(formData: FormData) {
  const targetType = text(formData, "targetType");
  return (targetType === "batch" ? "batch" : "material") as InventoryLinkTargetType;
}

export async function updateMaterialLocationStatusAction(formData: FormData) {
  await requireAuth();
  await setMaterialLocationStatus({
    materialId: text(formData, "materialId"),
    locationId: text(formData, "locationId"),
    status: materialLocationStatus(formData),
  });
  revalidateApp();
}

export async function updateMaterialAllLocationsStatusAction(formData: FormData) {
  await requireAuth();
  await setMaterialStatusForAllWarehouses(text(formData, "materialId"), materialLocationStatus(formData));
  revalidateApp();
}

export async function saveBomItemAction(formData: FormData) {
  await requireAuth();
  const parentMaterialId = text(formData, "parentMaterialId");
  await upsertBomItem({
    id: text(formData, "id") || undefined,
    parentMaterialId,
    childMaterialId: text(formData, "childMaterialId"),
    quantity: numberField(formData, "quantity"),
  });
  revalidateApp();
  redirect(`/materials/items?edit=${parentMaterialId}#bom`);
}

export async function deleteBomItemAction(formData: FormData) {
  await requireAuth();
  const parentMaterialId = text(formData, "parentMaterialId");
  await deleteBomItem(text(formData, "id"), parentMaterialId);
  revalidateApp();
  redirect(`/materials/items?edit=${parentMaterialId}#bom`);
}

export async function operateBomAction(formData: FormData) {
  await requireAuth();
  const parentMaterialId = text(formData, "parentMaterialId");
  const returnTo = text(formData, "returnTo") || `/materials/items?edit=${parentMaterialId}#bom`;
  const [returnPath, hash = ""] = returnTo.split("#");
  const errorPrefix = returnPath.includes("?")
    ? `${returnPath}&bomError=`
    : `${returnPath}?bomError=`;
  try {
    await operateBom({
      parentMaterialId,
      locationId: text(formData, "locationId"),
      toLocationId: text(formData, "toLocationId") || null,
      quantity: numberField(formData, "quantity"),
      operation: text(formData, "operation") as "consume" | "transfer" | "inactive",
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`${errorPrefix}${encodeURIComponent(reason)}${hash ? `#${hash}` : ""}`);
  }
  revalidateApp();
  redirect(returnTo);
}

export async function saveInventoryLinkGroupAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/materials/links?error=name");
  const group = await upsertInventoryLinkGroup({
    id: id || undefined,
    name,
    scope: inventoryLinkScope(formData),
  });
  revalidateApp();
  redirect(`/materials/links?edit=${group.id}`);
}

export async function addInventoryLinkItemAction(formData: FormData) {
  await requireAuth();
  const groupId = text(formData, "groupId");
  const targetType = inventoryLinkTargetType(formData);
  const targetId = text(formData, "targetId");
  try {
    await addInventoryLinkGroupItem({
      groupId,
      targetType,
      materialId: targetType === "material" ? targetId : null,
      batchId: targetType === "batch" ? targetId : null,
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/links?edit=${groupId}&error=${encodeURIComponent(reason)}`);
  }
  revalidateApp();
  redirect(`/materials/links?edit=${groupId}`);
}

export async function removeInventoryLinkItemAction(formData: FormData) {
  await requireAuth();
  const groupId = text(formData, "groupId");
  await removeInventoryLinkGroupItem(text(formData, "id"));
  revalidateApp();
  redirect(`/materials/links?edit=${groupId}`);
}

function indexedLinkedTransferItems(formData: FormData) {
  const indexes = new Set<number>();
  for (const key of formData.keys()) {
    const match = String(key).match(/^items\[(\d+)\]\./);
    if (match) indexes.add(Number(match[1]));
  }

  return [...indexes].sort((a, b) => a - b).map((index) => ({
    targetId: text(formData, `items[${index}].targetId`),
    targetType: (text(formData, `items[${index}].targetType`) === "batch" ? "batch" : "material") as InventoryLinkTargetType,
    enabled: bool(formData, `items[${index}].enabled`),
    quantity: numberField(formData, `items[${index}].quantity`),
  }));
}

function appendQuery(url: string, key: string, value: string) {
  const [path, hash = ""] = url.split("#");
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}${key}=${encodeURIComponent(value)}${hash ? `#${hash}` : ""}`;
}

export async function createLinkedTransferAction(formData: FormData) {
  await requireAuth();
  const groupId = text(formData, "groupId");
  const returnTo = text(formData, "returnTo") || `/materials/batches?linkGroup=${groupId}`;
  try {
    await createLinkedTransfer({
      groupId,
      fromLocationId: text(formData, "fromLocationId"),
      toLocationId: text(formData, "toLocationId"),
      date: text(formData, "date"),
      remark: text(formData, "remark"),
      items: indexedLinkedTransferItems(formData),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(appendQuery(returnTo, "linkError", reason));
  }
  revalidateApp();
  redirect(appendQuery(returnTo, "linkedTransfer", "1"));
}

export async function saveMaterialSizeAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const name = text(formData, "name");
  if (!name) redirect("/material-sizes?error=name");
  await upsertMaterialSize({
    name,
    remark: text(formData, "remark"),
  }, id || undefined);
  revalidateApp();
  redirect("/material-sizes");
}

export async function deleteMaterialSizeAction(formData: FormData) {
  await requireAuth();
  await deleteMaterialSize(text(formData, "id"));
  revalidateApp();
  redirect("/material-sizes");
}

export async function saveLocationAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const name = text(formData, "name");
  const type = text(formData, "type");
  if (!name) redirect("/locations?error=name");
  await upsertLocation(
    {
      name,
      type: (["warehouse", "other"].includes(type) ? type : "other") as LocationType,
    },
    id || undefined,
  );
  revalidateApp();
  redirect("/locations");
}

export async function deleteLocationAction(formData: FormData) {
  await requireAuth();
  try {
    await deleteLocation(text(formData, "id"));
  } catch {
    redirect("/locations?error=in-use");
  }
  revalidateApp();
  redirect("/locations");
}

export async function saveBatchAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const materialName = text(formData, "materialName");
  const productionDate = text(formData, "productionDate");
  const quantity = numberField(formData, "quantity");
  const totalPrice = numberField(formData, "totalPrice");
  const status = text(formData, "status");
  if (!materialName || !productionDate || quantity <= 0) {
    redirect("/materials/batches?error=required");
  }

  const warehouseLocationId = text(formData, "warehouseLocationId");
  const warehouseLocations = await listWarehouseLocations();
  const warehouse = warehouseLocations.find((location) => location.id === warehouseLocationId);
  if (!warehouse) {
    redirect("/materials/batches?error=warehouse");
  }

  const input = {
    materialName,
    materialCategory: text(formData, "materialCategory"),
    materialType: "",
    materialSize: "",
    materialUnit: "",
    materialRemark: "",
    productionDate,
    quantity,
    totalPrice,
    supplier: warehouse.name,
    manufacturer: "",
    initialLocationId: warehouse.id,
    status: (["active", "used_up", "inactive"].includes(status) ? status : "active") as BatchStatus,
    remark: text(formData, "remark"),
  };

  if (id) {
    await updateBatch(id, input);
  } else {
    await createBatch(input);
  }
  revalidateApp();
  redirect("/materials/batches");
}

export async function deleteBatchAction(formData: FormData) {
  await requireAuth();
  await deleteBatch(text(formData, "id"));
  revalidateApp();
  redirect("/materials/batches?deleted=1");
}

export async function deleteMovementAction(formData: FormData) {
  await requireAuth();
  const batchId = text(formData, "batchId");
  await deleteMovement(text(formData, "id"));
  revalidateApp();
  redirect(`/materials/batches/${batchId}?deletedMovement=1`);
}

export async function createMovementAction(formData: FormData) {
  await requireAuth();
  const batchId = text(formData, "batchId");
  const type = text(formData, "type");
  const quantity = numberField(formData, "quantity");
  const movementTotalPrice = numberField(formData, "movementTotalPrice");
  const location = text(formData, "locationId");
  const fromLocationId = text(formData, "fromLocationId");
  const toLocationId = text(formData, "toLocationId");

  const movementType = (["OUT", "TRANSFER", "RETURN", "SCRAP", "CONSUME", "STOCK_IN"].includes(type)
    ? type
    : "OUT") as MovementType;

  let from: string | null = null;
  let to: string | null = null;
  if (movementType === "OUT") to = toLocationId;
  if (movementType === "TRANSFER") {
    from = fromLocationId;
    to = toLocationId;
  }
  if (movementType === "RETURN") from = fromLocationId;
  if (movementType === "SCRAP" || movementType === "CONSUME") from = location;
  if (movementType === "STOCK_IN") to = toLocationId;

  try {
    await createMovement({
      batchId,
      date: text(formData, "date"),
      type: movementType,
      fromLocationId: from,
      toLocationId: to,
      quantity,
      totalPrice: movementType === "STOCK_IN" ? movementTotalPrice : null,
      remark: text(formData, "remark"),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/batches/${batchId}?error=${encodeURIComponent(reason)}`);
  }

  revalidateApp();
  redirect(`/materials/batches/${batchId}`);
}

export async function updateMovementAction(formData: FormData) {
  await requireAuth();
  const id = text(formData, "id");
  const batchId = text(formData, "batchId");
  const type = text(formData, "type");
  const quantity = numberField(formData, "quantity");
  const movementTotalPrice = numberField(formData, "movementTotalPrice");
  const location = text(formData, "locationId");
  const fromLocationId = text(formData, "fromLocationId");
  const toLocationId = text(formData, "toLocationId");
  const movementType = (["OUT", "TRANSFER", "RETURN", "SCRAP", "CONSUME", "STOCK_IN"].includes(type)
    ? type
    : "OUT") as MovementType;

  let from: string | null = null;
  let to: string | null = null;
  if (movementType === "OUT") to = toLocationId;
  if (movementType === "TRANSFER") {
    from = fromLocationId;
    to = toLocationId;
  }
  if (movementType === "RETURN") from = fromLocationId;
  if (movementType === "SCRAP" || movementType === "CONSUME") from = location;
  if (movementType === "STOCK_IN") to = toLocationId;

  try {
    await updateMovement({
      id,
      batchId,
      date: text(formData, "date"),
      type: movementType,
      fromLocationId: from,
      toLocationId: to,
      quantity,
      totalPrice: movementType === "STOCK_IN" ? movementTotalPrice : null,
      remark: text(formData, "remark"),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/batches/${batchId}?error=${encodeURIComponent(reason)}&editMovement=${id}`);
  }

  revalidateApp();
  redirect(`/materials/batches/${batchId}`);
}
