import Link from "next/link";
import { Bell, CheckCircle2, Pencil, RotateCcw, Search, Trash2 } from "lucide-react";

import type { Reminder } from "@/db/schema";
import {
  deleteReminderAction,
  saveReminderAction,
  toggleReminderHandledAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import { getReminderById, listReminders } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { PriorityBadge } from "@/components/priority-badge";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

type Params = { search?: string; date?: string; handled?: string; edit?: string };

export async function ReminderManager({ searchParams }: { searchParams: Params }) {
  const [items, editing] = await Promise.all([
    listReminders({
      search: searchParams.search,
      date: searchParams.date,
      handled: searchParams.handled as never,
    }),
    getReminderById(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">提醒事项</h1>
        <p className="mt-1 text-sm text-slate-500">记录日期提醒，首页会展示今日和即将到期内容。</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 md:grid-cols-[1fr_0.8fr_0.8fr_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input name="search" defaultValue={searchParams.search} placeholder="搜索提醒" className="pl-9" />
            </div>
            <Input name="date" type="date" defaultValue={searchParams.date} />
            <Select name="handled" defaultValue={searchParams.handled ?? "open"}>
              <option value="open">未处理</option>
              <option value="handled">已处理</option>
              <option value="all">全部</option>
            </Select>
            <Button type="submit" variant="secondary">筛选</Button>
            <Button asChild variant="ghost"><Link href="/reminders">清空</Link></Button>
          </form>
        </CardContent>
      </Card>
      <ReminderForm reminder={editing} />
      <ReminderList items={items} />
    </div>
  );
}

function ReminderForm({ reminder }: { reminder: Reminder | null }) {
  return (
    <Card id="reminder-form">
      <CardHeader>
        <CardTitle>{reminder ? "编辑提醒" : "新增提醒"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveReminderAction} className="grid gap-4">
          <input type="hidden" name="id" value={reminder?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="提醒标题">
              <Input name="title" defaultValue={reminder?.title} required />
            </Field>
            <Field label="优先级">
              <Select name="priority" defaultValue={reminder?.priority ?? "medium"}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </Select>
            </Field>
            <Field label="提醒日期">
              <Input name="reminderDate" type="date" defaultValue={reminder?.reminderDate ?? ""} required />
            </Field>
            <Field label="提醒时间（可选）">
              <Input name="reminderTime" type="time" defaultValue={reminder?.reminderTime} />
            </Field>
          </div>
          <Field label="提醒内容">
            <Textarea name="content" defaultValue={reminder?.content} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 text-sm font-medium text-slate-700">
            <input name="handled" type="checkbox" defaultChecked={reminder?.handled} className="h-4 w-4" />
            已处理
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{reminder ? "保存修改" : "新增提醒"}</SubmitButton>
            {reminder ? <Button asChild variant="outline"><Link href="/reminders">取消编辑</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ReminderList({ items }: { items: Reminder[] }) {
  if (!items.length) {
    return <EmptyState icon={Bell} title="暂无提醒" description="添加带日期的提醒事项，登录后即可在首页看到。" />;
  }

  return (
    <div className="grid gap-3">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <PriorityBadge priority={item.priority} />
                <Badge className={item.handled ? "border-slate-200 bg-slate-50 text-slate-500" : "border-sky-200 bg-sky-50 text-sky-700"}>
                  {item.handled ? "已处理" : "未处理"}
                </Badge>
              </div>
              <h3 className="mt-3 text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm text-slate-600">{item.content}</p>
              <p className="mt-3 text-sm text-slate-500">
                {formatDate(item.reminderDate)} {item.reminderTime || ""}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/reminders?edit=${item.id}#reminder-form`}><Pencil className="h-4 w-4" />编辑</Link>
              </Button>
              <form action={toggleReminderHandledAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="next" value={String(!item.handled)} />
                <SubmitButton variant="secondary" size="sm">
                  {item.handled ? <RotateCcw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  {item.handled ? "标未处理" : "已处理"}
                </SubmitButton>
              </form>
              <form action={deleteReminderAction}>
                <input type="hidden" name="id" value={item.id} />
                <SubmitButton variant="danger" size="sm"><Trash2 className="h-4 w-4" />删除</SubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
