import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  lt,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import {
  fixedItems,
  memos,
  reminders,
  tasks,
  type FixedItem,
  type Memo,
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

function compact<T>(items: Array<T | undefined | null | false>) {
  return items.filter(Boolean) as T[];
}

function searchValue(value?: string) {
  const clean = value?.trim();
  return clean ? `%${clean}%` : null;
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
    .orderBy(desc(tasks.plannedAt), desc(tasks.createdAt));
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
