import Link from "next/link";
import { NotebookText, Pencil, Pin, PinOff, Trash2 } from "lucide-react";

import { deleteMemoAction, saveMemoAction, toggleMemoPinnedAction } from "@/lib/actions";
import { formatDateTime } from "@/lib/dates";
import { getMemoById, listMemos } from "@/lib/data";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { Memo } from "@/db/schema";

type Params = { search?: string; tag?: string; edit?: string };

export async function MemoManager({ searchParams }: { searchParams: Params }) {
  const [items, editing] = await Promise.all([
    listMemos({ search: searchParams.search, tag: searchParams.tag }),
    getMemoById(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">备忘录</h1>
          <p className="mt-1 text-sm text-slate-500">记录灵感、客户信息和临时事项。</p>
        </div>
      </div>
      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto_auto]">
            <Input name="search" defaultValue={searchParams.search} placeholder="搜索标题 / 内容 / 标签" />
            <Input name="tag" defaultValue={searchParams.tag} placeholder="标签" />
            <Button type="submit" variant="secondary">筛选</Button>
            <Button asChild variant="ghost"><Link href="/memos">清空</Link></Button>
          </form>
        </CardContent>
      </Card>
      <MemoForm memo={editing} />
      <MemoList items={items} />
    </div>
  );
}

function MemoForm({ memo }: { memo: Memo | null }) {
  return (
    <Card id="memo-form">
      <CardHeader>
        <CardTitle>{memo ? "编辑备忘录" : "新增备忘录"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveMemoAction} className="grid gap-4">
          <input type="hidden" name="id" value={memo?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="标题">
              <Input name="title" defaultValue={memo?.title} required />
            </Field>
            <Field label="标签">
              <Input name="tags" defaultValue={memo?.tags} placeholder="用逗号分隔，例如 客户,灵感" />
            </Field>
          </div>
          <Field label="内容">
            <Textarea name="content" defaultValue={memo?.content} required />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input name="pinned" type="checkbox" defaultChecked={memo?.pinned} className="h-4 w-4" />
            置顶
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{memo ? "保存修改" : "新增备忘录"}</SubmitButton>
            {memo ? <Button asChild variant="outline"><Link href="/memos">取消编辑</Link></Button> : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function MemoList({ items }: { items: Memo[] }) {
  if (!items.length) {
    return <EmptyState icon={NotebookText} title="暂无备忘录" description="这里会显示你的文字记录。" />;
  }

  return (
    <div className="grid gap-3">
      {items.map((memo) => (
        <Card key={memo.id}>
          <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                {memo.pinned ? <Badge className="border-sky-200 bg-sky-50 text-sky-700">置顶</Badge> : null}
                {memo.tags
                  .split(",")
                  .map((tag) => tag.trim())
                  .filter(Boolean)
                  .map((tag) => (
                    <Badge key={tag} className="border-slate-200 bg-slate-50 text-slate-600">{tag}</Badge>
                  ))}
              </div>
              <h3 className="text-base font-semibold text-slate-950">{memo.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{memo.content}</p>
              <p className="mt-3 text-xs text-slate-500">更新：{formatDateTime(memo.updatedAt)}</p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <Button asChild variant="outline" size="sm">
                <Link href={`/memos?edit=${memo.id}#memo-form`}><Pencil className="h-4 w-4" />编辑</Link>
              </Button>
              <form action={toggleMemoPinnedAction}>
                <input type="hidden" name="id" value={memo.id} />
                <input type="hidden" name="next" value={String(!memo.pinned)} />
                <SubmitButton variant="secondary" size="sm">
                  {memo.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                  {memo.pinned ? "取消置顶" : "置顶"}
                </SubmitButton>
              </form>
              <form action={deleteMemoAction}>
                <input type="hidden" name="id" value={memo.id} />
                <SubmitButton variant="danger" size="sm">
                  <Trash2 className="h-4 w-4" />
                  删除
                </SubmitButton>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
