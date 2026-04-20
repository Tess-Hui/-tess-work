"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Priority } from "@/db/schema";
import {
  completeTask,
  createTask,
  deleteFixedItem,
  deleteMemo,
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
  upsertFixedItem,
  upsertMemo,
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
    "/memos",
    "/gantt",
  ].forEach((path) => revalidatePath(path));
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
