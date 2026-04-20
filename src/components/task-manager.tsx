import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Pencil,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import type { Task, TaskStatus } from "@/db/schema";
import {
  completeTaskAction,
  permanentDeleteTaskAction,
  reopenTaskAction,
  restoreTaskAction,
  saveTaskAction,
  trashTaskAction,
} from "@/lib/actions";
import { formatDateTime, toDateTimeInput } from "@/lib/dates";
import { listTasks, getTaskById } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge } from "@/components/priority-badge";
import { SubmitButton } from "@/components/submit-button";
import { TaskFormToggle } from "@/components/task-form-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type SearchParams = {
  search?: string;
  priority?: string;
  liaison?: string;
  date?: string;
  edit?: string;
  new?: string;
};

const pageMeta: Record<TaskStatus, { title: string; description: string }> = {
  todo: {
    title: "待办工作",
    description: "管理当前需要推进的工作、截止时间和对接人。",
  },
  completed: {
    title: "已完成工作",
    description: "查看已完成任务，可取消完成或移入废纸篓。",
  },
  trashed: {
    title: "废纸篓",
    description: "恢复误删任务，或永久删除不再需要的数据。",
  },
};

export async function TaskManager({
  status,
  searchParams,
}: {
  status: TaskStatus;
  searchParams: SearchParams;
}) {
  const [items, editing] = await Promise.all([
    listTasks({
      status,
      search: searchParams.search,
      priority: searchParams.priority as never,
      liaison: searchParams.liaison,
      date: searchParams.date,
    }),
    status === "todo" ? getTaskById(searchParams.edit) : null,
  ]);
  const meta = pageMeta[status];
  const showForm = status === "todo";

  return (
    <div className="grid gap-5">
      <PageTitle title={meta.title} description={meta.description} />
      <TaskFilters searchParams={searchParams} />
      {showForm ? (
        <TaskFormToggle initialOpen={Boolean(editing || searchParams.new === "1")}>
          <TaskForm task={editing} />
        </TaskFormToggle>
      ) : null}
      <TaskList items={items} status={status} />
    </div>
  );
}

function PageTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function TaskFilters({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <form className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.9fr_0.9fr_auto_auto]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              name="search"
              defaultValue={searchParams.search}
              placeholder="搜索工作内容 / 备注 / 对接人"
              className="pl-9"
            />
          </div>
          <Select name="priority" defaultValue={searchParams.priority ?? "all"}>
            <option value="all">全部优先级</option>
            <option value="high">高优先级</option>
            <option value="medium">中优先级</option>
            <option value="low">低优先级</option>
          </Select>
          <Input name="liaison" defaultValue={searchParams.liaison} placeholder="对接人" />
          <Input name="date" type="date" defaultValue={searchParams.date} />
          <Button type="submit" variant="secondary">
            筛选
          </Button>
          <Button asChild variant="ghost">
            <Link href="?">清空</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskForm({ task }: { task: Task | null }) {
  return (
    <Card id="task-form">
      <CardHeader>
        <CardTitle>{task ? "编辑任务 Edit Task" : "新增任务 New Task"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveTaskAction} className="grid gap-4">
          <input type="hidden" name="id" value={task?.id ?? ""} />
          <Field label="工作内容">
            <Textarea name="content" defaultValue={task?.content} required />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="计划完成时间 Planned due">
              <Input name="plannedAt" type="datetime-local" defaultValue={toDateTimeInput(task?.plannedAt)} />
            </Field>
            <Field label="实际完成时间 Completed at">
              <Input
                name="completedAt"
                type="datetime-local"
                defaultValue={toDateTimeInput(task?.completedAt)}
              />
            </Field>
            <Field label="对接人">
              <Input name="liaison" defaultValue={task?.liaison} placeholder="例如：客户 / 同事 / 供应商" />
            </Field>
            <Field label="重要级">
              <Select name="priority" defaultValue={task?.priority ?? "medium"}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </Select>
            </Field>
          </div>
          <Field label="备注">
            <Textarea name="notes" defaultValue={task?.notes} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{task ? "保存修改" : "新增任务"}</SubmitButton>
            {task ? (
              <Button asChild variant="outline">
                <Link href="/tasks">取消编辑</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function TaskList({ items, status }: { items: Task[]; status: TaskStatus }) {
  if (!items.length) {
    return (
      <EmptyState
        icon={status === "trashed" ? Trash2 : ClipboardList}
        title="暂无数据"
        description="这里会显示符合当前筛选条件的任务。"
      />
    );
  }

  return (
    <div className="grid gap-3">
      {items.map((task) => (
        <Card key={task.id} className="overflow-hidden">
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={task.priority} />
                <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                  {task.status === "todo"
                    ? "待办"
                    : task.status === "completed"
                      ? "已完成"
                      : "废纸篓"}
                </Badge>
                {task.liaison ? (
                  <Badge className="border-sky-200 bg-sky-50 text-sky-700">{task.liaison}</Badge>
                ) : null}
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{task.content}</h3>
              <div className="mt-3 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                <span>计划完成：{formatDateTime(task.plannedAt)}</span>
                <span>实际完成：{formatDateTime(task.completedAt)}</span>
                <span>创建：{formatDateTime(task.createdAt)}</span>
                <span>更新：{formatDateTime(task.updatedAt)}</span>
              </div>
              {task.notes ? <p className="mt-3 text-sm text-slate-600">{task.notes}</p> : null}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              {status === "todo" ? (
                <>
                  <form action={completeTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="secondary" size="sm">
                      <CheckCircle2 className="h-4 w-4" />
                      完成
                    </SubmitButton>
                  </form>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/tasks?edit=${task.id}#task-form`}>
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Link>
                  </Button>
                  <form action={trashTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="danger" size="sm">
                      <Trash2 className="h-4 w-4" />
                      删除
                    </SubmitButton>
                  </form>
                </>
              ) : null}
              {status === "completed" ? (
                <>
                  <form action={reopenTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="secondary" size="sm">
                      <XCircle className="h-4 w-4" />
                      取消完成
                    </SubmitButton>
                  </form>
                  <form action={trashTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="danger" size="sm">
                      <Trash2 className="h-4 w-4" />
                      删除
                    </SubmitButton>
                  </form>
                </>
              ) : null}
              {status === "trashed" ? (
                <>
                  <form action={restoreTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="secondary" size="sm">
                      <RotateCcw className="h-4 w-4" />
                      恢复
                    </SubmitButton>
                  </form>
                  <form action={permanentDeleteTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <SubmitButton variant="danger" size="sm">
                      <Trash2 className="h-4 w-4" />
                      永久删除
                    </SubmitButton>
                  </form>
                </>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
