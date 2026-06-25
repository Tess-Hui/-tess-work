import Link from "next/link";
import { Link2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  addInventoryLinkItemAction,
  removeInventoryLinkItemAction,
  saveInventoryLinkGroupAction,
} from "@/lib/actions";
import {
  listBatches,
  listInventoryLinkGroups,
  listMaterials,
} from "@/lib/data";

type Params = {
  edit?: string;
  error?: string;
};

const scopeLabels = {
  material: "按物料长期链接",
  batch: "按批次临时链接",
} as const;

export async function InventoryLinkManager({ searchParams }: { searchParams: Params }) {
  const [groups, materials, batches] = await Promise.all([
    listInventoryLinkGroups(),
    listMaterials({ sort: "name-asc" }),
    listBatches(),
  ]);
  const editing = groups.find((group) => group.id === searchParams.edit) ?? null;

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料联动组</h1>
          <p className="mt-1 text-sm text-slate-500">把需要一起调货的物料先链接成组，再到物料总库存里直接联动调货。</p>
        </div>
        <Button asChild variant="outline">
          <Link href="/materials/batches">返回物料总库存</Link>
        </Button>
      </div>

      {searchParams.error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            联动组保存失败，请检查是否重复添加，或组类型和添加对象是否一致。
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{editing ? "编辑联动组" : "新建联动组"}</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={saveInventoryLinkGroupAction} className="grid gap-3 md:grid-cols-[1fr_0.8fr_auto_auto] md:items-end">
            <input type="hidden" name="id" value={editing?.id ?? ""} />
            <Field label="组名">
              <Input name="name" defaultValue={editing?.name} placeholder="例如：新贺卡三件套" required />
            </Field>
            <Field label="链接方式">
              <Select name="scope" defaultValue={editing?.scope ?? "material"}>
                <option value="material">按物料长期链接</option>
                <option value="batch">按批次临时链接</option>
              </Select>
            </Field>
            <SubmitButton>{editing ? "保存联动组" : "创建联动组"}</SubmitButton>
            {editing ? (
              <Button asChild variant="outline">
                <Link href="/materials/links">取消</Link>
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>添加组内项目</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <form action={addInventoryLinkItemAction} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <input type="hidden" name="groupId" value={editing.id} />
              <input type="hidden" name="targetType" value={editing.scope} />
              <Field label={editing.scope === "batch" ? "选择批次" : "选择物料"}>
                <Select name="targetId" required>
                  <option value="">选择要链接的{editing.scope === "batch" ? "批次" : "物料"}</option>
                  {editing.scope === "batch" ? (
                    batches.map((row) => (
                      <option key={row.batch.id} value={row.batch.id}>
                        {row.batch.batchCode} / {row.material.name}
                      </option>
                    ))
                  ) : (
                    materials.map((material) => (
                      <option key={material.id} value={material.id}>
                        {material.category} / {material.name}
                      </option>
                    ))
                  )}
                </Select>
              </Field>
              <SubmitButton variant="secondary">添加到组</SubmitButton>
            </form>
          </CardContent>
        </Card>
      ) : null}

      {groups.length ? (
        <div className="grid gap-3">
          {groups.map((group) => (
            <Card key={group.id} className={editing?.id === group.id ? "border-emerald-200" : ""}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">已联动</Badge>
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">{scopeLabels[group.scope]}</Badge>
                    </div>
                    <h2 className="mt-2 text-base font-semibold text-slate-950">{group.name}</h2>
                    <p className="mt-1 text-sm text-slate-500">组内项目：{group.items.length} 个</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="secondary" size="sm">
                      <Link href={`/materials/batches?linkGroup=${group.id}`}>去库存里调货</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/materials/links?edit=${group.id}`}>维护</Link>
                    </Button>
                  </div>
                </div>

                {group.items.length ? (
                  <div className="grid gap-2">
                    {group.items.map((item) => (
                      <div key={item.id} className="flex flex-col gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="font-medium text-slate-950">
                            {item.name}
                            {item.batchCode ? <span className="ml-2 text-sm font-normal text-slate-500">{item.batchCode}</span> : null}
                          </p>
                          <p className="mt-1 text-sm text-slate-500">
                            {item.category || "未分类"} · 进行中库存 {item.activeStock.toFixed(2)} {item.unit}
                          </p>
                        </div>
                        <form action={removeInventoryLinkItemAction}>
                          <input type="hidden" name="groupId" value={group.id} />
                          <input type="hidden" name="id" value={item.id} />
                          <SubmitButton variant="danger" size="sm">移除</SubmitButton>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                    还没有添加组内物料。
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Link2} title="暂无联动组" description="先创建联动组，再把新贺卡的贴标、内页、信封加入同一组。" />
      )}
    </div>
  );
}
