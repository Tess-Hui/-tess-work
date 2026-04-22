import Link from "next/link";
import { Pencil, Ruler, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { deleteMaterialSizeAction, saveMaterialSizeAction } from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import { getMaterialSizeById, listMaterialSizes } from "@/lib/data";

type Params = {
  search?: string;
  edit?: string;
  new?: string;
};

export async function MaterialSizeManager({ searchParams }: { searchParams: Params }) {
  const [items, editing] = await Promise.all([
    listMaterialSizes({ search: searchParams.search }),
    getMaterialSizeById(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料尺寸管理</h1>
          <p className="mt-1 text-sm text-slate-500">集中维护常用尺寸，便于物料录入时统一口径。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/material-sizes?new=1#material-size-form">新增尺寸</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <Input name="search" defaultValue={searchParams.search} placeholder="搜索尺寸名称或备注" />
            <Button type="submit" variant="secondary">查询</Button>
            <Button asChild variant="ghost">
              <Link href="/material-sizes">清空</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {editing || searchParams.new === "1" ? <MaterialSizeForm size={editing} /> : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((size) => (
            <Card key={size.id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="font-semibold text-slate-950">{size.name}</p>
                  <p className="mt-1 text-sm text-slate-500">添加时间：{formatDate(size.createdAt)}</p>
                  {size.remark ? <p className="mt-2 text-sm text-slate-600">{size.remark}</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/material-sizes?edit=${size.id}#material-size-form`}>
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Link>
                  </Button>
                  <form action={deleteMaterialSizeAction}>
                    <input type="hidden" name="id" value={size.id} />
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
      ) : (
        <EmptyState icon={Ruler} title="暂无尺寸" description="新增常用物料尺寸后，可在这里集中查看和维护。" />
      )}
    </div>
  );
}

function MaterialSizeForm({
  size,
}: {
  size: Awaited<ReturnType<typeof getMaterialSizeById>>;
}) {
  return (
    <Card id="material-size-form">
      <CardHeader>
        <CardTitle>{size ? "编辑尺寸" : "新增尺寸"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveMaterialSizeAction} className="grid gap-4">
          <input type="hidden" name="id" value={size?.id ?? ""} />
          <Field label="尺寸名称">
            <Input name="name" defaultValue={size?.name} placeholder="例如：10cm x 20cm / M / 3米" required />
          </Field>
          <Field label="备注">
            <Textarea name="remark" defaultValue={size?.remark} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{size ? "保存修改" : "新增尺寸"}</SubmitButton>
            {size ? (
              <Button asChild variant="outline">
                <Link href="/material-sizes">取消编辑</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
