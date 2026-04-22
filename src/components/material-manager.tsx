import { Package, Pencil } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { saveMaterialAction } from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import { getMaterialById, listMaterials } from "@/lib/data";

type Params = { edit?: string; new?: string };

export async function MaterialManager({ searchParams }: { searchParams: Params }) {
  const [items, editing] = await Promise.all([
    listMaterials(),
    getMaterialById(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料列表</h1>
          <p className="mt-1 text-sm text-slate-500">维护物料名称、类型、尺寸和单位。</p>
        </div>
        <Button asChild>
          <Link href="/materials/items?new=1#material-form">新增物料</Link>
        </Button>
      </div>

      {editing || searchParams.new === "1" ? <MaterialForm material={editing} /> : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-base font-semibold text-slate-950">{item.name}</p>
                  <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                    <span>类型：{item.type || "未填写"}</span>
                    <span>尺寸：{item.size || "未填写"}</span>
                    <span>当前库存：{item.currentStock.toFixed(2)} {item.unit}</span>
                    <span>最近使用：{item.latestUsedAt ? formatDate(item.latestUsedAt) : "暂无"}</span>
                  </div>
                  {item.remark ? <p className="mt-2 text-sm text-slate-600">{item.remark}</p> : null}
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/materials/items?edit=${item.id}#material-form`}>
                    <Pencil className="h-4 w-4" />
                    编辑
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="暂无物料" description="新增物料后即可创建批次。" />
      )}
    </div>
  );
}

function MaterialForm({
  material,
}: {
  material: Awaited<ReturnType<typeof getMaterialById>>;
}) {
  return (
    <Card id="material-form">
      <CardHeader>
        <CardTitle>{material ? "编辑物料" : "新增物料"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveMaterialAction} className="grid gap-4">
          <input type="hidden" name="id" value={material?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="名称">
              <Input name="name" defaultValue={material?.name} required />
            </Field>
            <Field label="类型">
              <Input name="type" defaultValue={material?.type} />
            </Field>
            <Field label="尺寸信息">
              <Input name="size" defaultValue={material?.size} />
            </Field>
            <Field label="单位">
              <Input name="unit" defaultValue={material?.unit} placeholder="米 / 个 / 卷 / 公斤" />
            </Field>
          </div>
          <Field label="备注">
            <Textarea name="remark" defaultValue={material?.remark} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{material ? "保存修改" : "新增物料"}</SubmitButton>
            {material ? (
              <Button asChild variant="outline">
                <Link href="/materials/items">取消编辑</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
