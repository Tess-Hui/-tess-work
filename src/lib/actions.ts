"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { BatchStatus, LocationType, MovementType, Priority } from "@/db/schema";
import {
  createBatch,
  createMovement,
  completeTask,
  createTask,
  deleteFixedItem,
  deleteLocation,
  deleteReminder,
  moveTaskToTrash,
  permanentlyDeleteTask,
  reopenTask,
  restoreTask,
  toggleFixedDashboard,
  toggleFixedPinned,
  toggleReminderHandled,
  updateTask,
  updateBatch,
  upsertFixedItem,
  upsertLocation,
  upsertMaterial,
  upsertReminder,
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
    "/gantt",
    "/materials",
    "/materials/items",
    "/materials/batches",
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
    remark: text(formData, "remark"),
  }, id || undefined);
  revalidateApp();
  redirect("/materials/items");
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
      type: (["warehouse", "factory", "other"].includes(type) ? type : "other") as LocationType,
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
  const materialId = text(formData, "materialId");
  const productionDate = text(formData, "productionDate");
  const quantity = numberField(formData, "quantity");
  const price = numberField(formData, "price");
  const status = text(formData, "status");
  if ((!id && !materialId) || !productionDate || quantity <= 0) {
    redirect("/materials/batches?error=required");
  }

  const input = {
    productionDate,
    quantity,
    price,
    supplier: text(formData, "supplier"),
    manufacturer: text(formData, "manufacturer"),
    status: (["active", "used_up", "inactive"].includes(status) ? status : "active") as BatchStatus,
    remark: text(formData, "remark"),
  };

  if (id) {
    await updateBatch(id, input);
  } else {
    await createBatch({
      ...input,
      materialId,
      initialLocationId: text(formData, "initialLocationId"),
    });
  }
  revalidateApp();
  redirect("/materials/batches");
}

export async function createMovementAction(formData: FormData) {
  await requireAuth();
  const batchId = text(formData, "batchId");
  const type = text(formData, "type");
  const quantity = numberField(formData, "quantity");
  const location = text(formData, "locationId");
  const fromLocationId = text(formData, "fromLocationId");
  const toLocationId = text(formData, "toLocationId");

  const movementType = (["OUT", "TRANSFER", "RETURN", "SCRAP", "CONSUME"].includes(type)
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

  try {
    await createMovement({
      batchId,
      date: text(formData, "date"),
      type: movementType,
      fromLocationId: from,
      toLocationId: to,
      quantity,
      remark: text(formData, "remark"),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "failed";
    redirect(`/materials/batches/${batchId}?error=${encodeURIComponent(reason)}`);
  }

  revalidateApp();
  redirect(`/materials/batches/${batchId}`);
}
