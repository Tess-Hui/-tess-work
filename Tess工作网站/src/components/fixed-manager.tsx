import Link from "next/link";
import { Eye, EyeOff, Pencil, Pin, PinOff, Search, Trash2 } from "lucide-react";

import type { FixedItem } from "@/db/schema";
import {
  deleteFixedItemAction,
  saveFixedItemAction,
  toggleFixedDashboardAction,
  toggleFixedPinnedAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import { getFixedItemById, listFixedItems } from "@/lib/data";
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

type Params = { search?: string; category?: string; edit?: string };

export async function FixedManager({ searchParams }: { searchParams: Params }) {
  const [items, editing] = await Promise.all([
    listFixedItems(searchParams),
    getFixedItemById(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">固定事项</h1>
        <p className="mt-1 text-sm text-slate-500">长期注意事项、固定规则和需要置顶的重点信息。</p>
      </div>
      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input name="search" defaultValue={searchParams.search} placeholder="搜索标题 / 内容 / 分类" className="pl-9" />
            </div>
            <Input name="category" defaultValue={searchParams.category} placeholder="分类筛选" />
            <Button type="submit" variant="secondary">筛选</Button>
            <Button asChild variant="ghost"><Link href="/fixed">清空</Link></Button>
          </form>
        </CardContent>
      </Card>
      <FixedForm item={editing} />
      <FixedList items={items} />
    </div>
  );
}

function FixedForm({ item }: { item: FixedItem | null }) {
  return (
    <Card id="fixed-form">
      <CardHeader>
        <CardTitle>{item ? "编辑固定事项" : "新增固定事项"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveFixedItemAction} className="grid gap-4">
          <input type="hidden" name="id" value={item?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="标题">
              <Input name="title" defaultValue={item?.title} required />
            </Field>
            <Field label="分类">
              <Input name="category" defaultValue={item?.category ?? "General"} />
            </Field>
          </div>
          <Field label="内容">
            <Textarea name="content" defaultValue={item?.content} required />
          </Field>
          <div className="grid gap-4 md:grid-cols-3">
            <Field label="重要级">
              <Select name="priority" defaultValue={item?.priority ?? "medium"}>
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </Select>
            </Field>
            <Field label="生效日期">
              <Input name="startDate" type="date" defaultValue={item?.startDate ?? ""} />
            </Field>
            <Field label="结束日期">
              <Input name="endDate" type="date" defaultValue={item?.endDate ?? ""} />
            </Field>
          </div>
          <div className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2">
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
              <input name="pinned" type="checkbox" defaultChecked={item?.pinned} className="h-4 w-4" />
              置顶
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-medium text-slate-700">
              <input
                name="showOnDashboard"
                type="checkbox"
                defaultChecked={item?.showOnDashboard ?? true}
                className="h-4 w-4"
              />
              首页显示
            </label>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{item ? "保存修改" : "新增固定事项"}</SubmitButton>
            {item ? <Button asChild variant="outline"><Link href="/fixed">取消编辑</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function FixedList({ items }: { items: FixedItem[] }) {
  if (!items.length) {
    return <EmptyState icon={Pin} title="暂无固定事项" description="记录长期规则、重要说明和常用信息。" />;
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((item) => (
        <Card key={item.id}>
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <PriorityBadge priority={item.priority} />
              <Badge className="border-slate-200 bg-slate-50 text-slate-600">{item.category}</Badge>
              {item.pinned ? <Badge className="border-sky-200 bg-sky-50 text-sky-700">置顶</Badge> : null}
              {item.showOnDashboard ? <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">首页</Badge> : null}
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{item.content}</p>
              <p className="mt-3 text-xs text-slate-500">
                {formatDate(item.startDate)} - {formatDate(item.endDate)}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link href={`/fixed?edit=${item.id}#fixed-form`}><Pencil className="h-4 w-4" />编辑</Link>
              </Button>
              <form action={toggleFixedPinnedAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="next" value={String(!item.pinned)} />
                <SubmitButton variant="secondary" size="sm">
                  {item.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {item.pinned ? "取消置顶" : "置顶"}
                </SubmitButton>
              </form>
              <form action={toggleFixedDashboardAction}>
                <input type="hidden" name="id" value={item.id} />
                <input type="hidden" name="next" value={String(!item.showOnDashboard)} />
                <SubmitButton variant="secondary" size="sm">
                  {item.showOnDashboard ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  {item.showOnDashboard ? "隐藏首页" : "显示首页"}
                </SubmitButton>
              </form>
              <form action={deleteFixedItemAction}>
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
