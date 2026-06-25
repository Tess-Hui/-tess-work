import { Package, Pencil } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteBomItemAction,
  operateBomAction,
  saveBomItemAction,
  saveMaterialAction,
  updateMaterialAllLocationsStatusAction,
  updateMaterialLocationStatusAction,
} from "@/lib/actions";
import { formatDate } from "@/lib/dates";
import {
  getMaterialById,
  listBomItems,
  listMaterialCategories,
  listMaterials,
  listWarehouseLocations,
} from "@/lib/data";

type Params = {
  edit?: string;
  new?: string;
  sort?: string;
  search?: string;
  category?: string;
  warehouse?: string;
  status?: string;
  alert?: string;
  bomError?: string;
};

const statusLabels = {
  active: "进行中",
  used_up: "已用完",
  inactive: "已停用",
} as const;

const statusClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  used_up: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export async function MaterialManager({ searchParams }: { searchParams: Params }) {
  const [items, editing, categories, warehouses, allMaterials] = await Promise.all([
    listMaterials({
      sort: searchParams.sort,
      search: searchParams.search,
      category: searchParams.category,
      warehouse: searchParams.warehouse,
      status: searchParams.status as never,
      alert: searchParams.alert,
    }),
    getMaterialById(searchParams.edit),
    listMaterialCategories(),
    listWarehouseLocations(),
    listMaterials({ sort: "name-asc" }),
  ]);
  const bomRows = editing ? await listBomItems(editing.id) : [];

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料列表</h1>
          <p className="mt-1 text-sm text-slate-500">维护物料名称、类型、尺寸和单位。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/materials/items?new=1#material-form">新增物料</Link>
        </Button>
      </div>

      <Card>
        <CardContent className="pt-5">
          <div className="mb-3 flex flex-wrap gap-2">
            <Button asChild size="sm" variant={!searchParams.status && !searchParams.alert ? "default" : "secondary"}>
              <Link href="/materials/items">全部</Link>
            </Button>
            <Button asChild size="sm" variant={searchParams.status === "active" ? "default" : "secondary"}>
              <Link href="/materials/items?status=active">进行中</Link>
            </Button>
            <Button asChild size="sm" variant={searchParams.status === "inactive" ? "default" : "secondary"}>
              <Link href="/materials/items?status=inactive">已停用</Link>
            </Button>
            <Button asChild size="sm" variant={searchParams.status === "used_up" ? "default" : "secondary"}>
              <Link href="/materials/items?status=used_up">已用完</Link>
            </Button>
            <Button asChild size="sm" variant={searchParams.alert === "1" ? "default" : "secondary"}>
              <Link href="/materials/items?alert=1">告急</Link>
            </Button>
          </div>
          <form className="grid gap-3 lg:grid-cols-[1.1fr_0.8fr_0.8fr_0.8fr_0.9fr_auto_auto]">
            <Input name="search" defaultValue={searchParams.search} placeholder="搜索大类 / 名称 / 仓库" />
            <Select name="category" defaultValue={searchParams.category ?? "all"}>
              <option value="all">全部大类</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </Select>
            <Select name="warehouse" defaultValue={searchParams.warehouse ?? "all"}>
              <option value="all">全部仓库</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
              ))}
            </Select>
            <Select name="status" defaultValue={searchParams.status ?? "all"}>
              <option value="all">全部状态</option>
              <option value="active">进行中</option>
              <option value="inactive">已停用</option>
              <option value="used_up">已用完</option>
              <option value="alert">库存告急</option>
            </Select>
            <Select name="sort" defaultValue={searchParams.sort ?? "created-desc"}>
              <option value="created-desc">添加时间最新在前</option>
              <option value="created-asc">添加时间最早在前</option>
              <option value="name-asc">按名称排序</option>
              <option value="latest-used">按最近使用时间</option>
              <option value="stock-desc">按库存数量</option>
            </Select>
            <Button type="submit" variant="secondary">排序</Button>
            <Button asChild variant="ghost">
              <Link href="/materials/items">清空</Link>
            </Button>
          </form>
        </CardContent>
      </Card>

      {editing || searchParams.new === "1" ? (
        <MaterialForm
          material={editing}
          categories={categories}
          materials={allMaterials}
          warehouses={warehouses}
          bomRows={bomRows}
          bomError={searchParams.bomError}
        />
      ) : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <p className="text-base font-semibold text-slate-950">{item.name}</p>
                  <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                    <span>大类：{item.category || "未分类"}</span>
                    <span>类型：{item.type || "未填写"}</span>
                    <span>物料尺寸：{item.size || "未填写"}</span>
                    <span>当前库存：{item.currentStock.toFixed(2)} {item.unit}</span>
                    <span>最近使用：{item.latestUsedAt ? formatDate(item.latestUsedAt) : "暂无"}</span>
                  </div>
                  {item.locations.length ? (
                    <div className="mt-3 grid gap-2">
                      {item.locations.slice(0, 3).map((location) => (
                        <div key={location.locationId} className="flex flex-col gap-2 rounded-md border border-slate-100 bg-slate-50 p-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm text-slate-600">
                            <span className="font-medium text-slate-800">{location.locationName}</span>
                            <span className="ml-2">{location.stock.toFixed(2)} {item.unit}</span>
                            <Badge className={`ml-2 ${statusClasses[location.status]}`}>{statusLabels[location.status]}</Badge>
                          </div>
                          <form action={updateMaterialLocationStatusAction} className="flex gap-2">
                            <input type="hidden" name="materialId" value={item.id} />
                            <input type="hidden" name="locationId" value={location.locationId} />
                            <Select name="status" defaultValue={location.status} className="h-9 text-xs">
                              <option value="active">进行中</option>
                              <option value="inactive">已停用</option>
                              <option value="used_up">已用完</option>
                            </Select>
                            <SubmitButton size="sm" variant="secondary">更新</SubmitButton>
                          </form>
                        </div>
                      ))}
                    </div>
                  ) : null}
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
  categories,
  materials,
  warehouses,
  bomRows,
  bomError,
}: {
  material: Awaited<ReturnType<typeof getMaterialById>>;
  categories: Awaited<ReturnType<typeof listMaterialCategories>>;
  materials: Awaited<ReturnType<typeof listMaterials>>;
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  bomRows: Awaited<ReturnType<typeof listBomItems>>;
  bomError?: string;
}) {
  return (
    <div className="grid gap-4">
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
            <Field label="物料大类">
              <Select name="category" defaultValue={material?.category || "未分类"}>
                {[...new Set([material?.category, ...categories, "未分类"].filter(Boolean))].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
            <Field label="物料尺寸">
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

      {material ? (
        <Card id="bom">
          <CardHeader>
            <CardTitle>BOM物料结构</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {bomError ? (
              <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                BOM操作失败：{bomError === "INSUFFICIENT_STOCK" ? "库存不足" : bomError}
              </p>
            ) : null}

            <form action={saveBomItemAction} className="grid gap-3 md:grid-cols-[1fr_0.5fr_auto] md:items-end">
              <input type="hidden" name="parentMaterialId" value={material.id} />
              <Field label="组成物料">
                <Select name="childMaterialId" required>
                  <option value="">选择组成物料</option>
                  {materials
                    .filter((item) => item.id !== material.id)
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.category} / {item.name}</option>
                    ))}
                </Select>
              </Field>
              <Field label="单件用量">
                <Input name="quantity" type="number" min="0" step="0.01" required />
              </Field>
              <SubmitButton>添加组成物料</SubmitButton>
            </form>

            <div className="grid gap-2">
              {bomRows.length ? (
                bomRows.map((row) => (
                  <div key={row.bom.id} className="flex flex-col gap-3 rounded-md border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-950">{row.child.name}</p>
                      <p className="text-sm text-slate-500">大类：{row.child.category} · 用量：{Number(row.bom.quantity).toFixed(2)} {row.child.unit}</p>
                    </div>
                    <form action={deleteBomItemAction}>
                      <input type="hidden" name="id" value={row.bom.id} />
                      <input type="hidden" name="parentMaterialId" value={material.id} />
                      <SubmitButton variant="danger" size="sm">删除</SubmitButton>
                    </form>
                  </div>
                ))
              ) : (
                <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                  暂未绑定组成物料。
                </p>
              )}
            </div>

            <form action={operateBomAction} className="grid gap-3 lg:grid-cols-[0.8fr_0.8fr_0.8fr_0.8fr_auto] lg:items-end">
              <input type="hidden" name="parentMaterialId" value={material.id} />
              <Field label="操作">
                <Select name="operation" defaultValue="consume">
                  <option value="consume">一键出库</option>
                  <option value="transfer">一键调拨</option>
                  <option value="inactive">一键停用</option>
                </Select>
              </Field>
              <Field label="来源仓库">
                <Select name="locationId" required>
                  <option value="">选择仓库</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="目标仓库">
                <Select name="toLocationId">
                  <option value="">仅调拨时选择</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="成品数量">
                <Input name="quantity" type="number" min="0" step="0.01" defaultValue="1" />
              </Field>
              <SubmitButton variant="secondary">执行BOM操作</SubmitButton>
            </form>

            <form action={updateMaterialAllLocationsStatusAction} className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <input type="hidden" name="materialId" value={material.id} />
              <Field label="当前物料全部仓库状态">
                <Select name="status" defaultValue="inactive">
                  <option value="active">进行中</option>
                  <option value="inactive">已停用</option>
                  <option value="used_up">已用完</option>
                </Select>
              </Field>
              <SubmitButton variant="secondary">批量更新状态</SubmitButton>
            </form>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
