import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  ClipboardList,
  NotebookText,
  Pin,
  Siren,
} from "lucide-react";

import { LocationStockVisualization } from "@/components/location-stock-visualization";
import { PriorityBadge } from "@/components/priority-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getDashboardData } from "@/lib/data";
import { formatDate, formatDateTime } from "@/lib/dates";

export const dynamic = "force-dynamic";

const statIcons = {
  pendingTasks: ClipboardList,
  todayReminders: Bell,
  completedTasks: CheckCircle2,
  highPriorityTasks: Siren,
  fixedItems: Pin,
  memos: NotebookText,
};

export default async function DashboardPage() {
  const data = await getDashboardData();
  const stats = [
    { key: "pendingTasks", label: "待办工作", value: data.counts.pendingTasks },
    { key: "todayReminders", label: "今日提醒", value: data.counts.todayReminders },
    { key: "completedTasks", label: "已完成", value: data.counts.completedTasks },
    { key: "highPriorityTasks", label: "高优先级", value: data.counts.highPriorityTasks },
    { key: "fixedItems", label: "固定事项", value: data.counts.fixedItems },
    { key: "memos", label: "备忘录", value: data.counts.memos },
  ] as const;

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">首页总览</h1>
          <p className="mt-1 text-sm text-slate-500">一进入系统即可查看今天最重要的内容。</p>
        </div>
        <Button asChild>
          <Link href="/tasks?new=1#task-form">
            <ClipboardList className="h-4 w-4" />
            新增待办
          </Link>
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {stats.map((stat) => {
          const Icon = statIcons[stat.key];
          return (
            <Card key={stat.key}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">{stat.label}</span>
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <p className="mt-3 text-3xl font-semibold text-slate-950">{stat.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>今日待办 / 即将到期</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.upcomingTasks.length ? (
              data.upcomingTasks.map((task) => (
                <Link key={task.id} href={`/tasks?edit=${task.id}#task-form`} className="rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={task.priority} />
                    {task.liaison ? <Badge className="border-sky-200 bg-sky-50 text-sky-700">{task.liaison}</Badge> : null}
                  </div>
                  <p className="mt-2 font-medium text-slate-950">{task.content}</p>
                  <p className="mt-1 text-sm text-slate-500">计划完成：{formatDateTime(task.plannedAt)}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无今日或即将到期任务。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>置顶固定事项</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.pinnedFixed.length ? (
              data.pinnedFixed.map((item) => (
                <Link key={item.id} href={`/fixed?edit=${item.id}#fixed-form`} className="rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                  <div className="flex flex-wrap items-center gap-2">
                    <PriorityBadge priority={item.priority} />
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">{item.category}</Badge>
                  </div>
                  <p className="mt-2 font-medium text-slate-950">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.content}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无置顶固定事项。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>提醒事项</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.reminderPreview.length ? (
              data.reminderPreview.map((reminder) => (
                <Link key={reminder.id} href={`/reminders?edit=${reminder.id}#reminder-form`} className="rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-950">{reminder.title}</p>
                    <PriorityBadge priority={reminder.priority} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{formatDate(reminder.reminderDate)} {reminder.reminderTime}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无未处理提醒。</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>最近备忘录</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {data.recentMemos.length ? (
              data.recentMemos.map((memo) => (
                <Link key={memo.id} href={`/memos?edit=${memo.id}#memo-form`} className="rounded-md border border-slate-200 p-3 hover:bg-slate-50">
                  <p className="font-medium text-slate-950">{memo.title}</p>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500">{memo.content}</p>
                </Link>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">暂无备忘录。</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3">
        <LocationStockVisualization title="仓库库存简览" items={data.locationStockPreview} compact />
      </section>
    </div>
  );
}
