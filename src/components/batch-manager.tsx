import Link from "next/link";
import { Package, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { saveBatchAction } from "@/lib/actions";
import { getBatchDetail, listBatches, listLocations, listMaterials } from "@/lib/data";

type Params = {
  date?: string;
  materialId?: string;
  materialName?: string;
  status?: string;
  supplier?: string;
  manufacturer?: string;
  edit?: string;
  new?: string;
};

const statusLabels = {
  active: "进行中",
  used_up: "已用完",
  inactive: "已停用",
} as const;

export async function BatchManager({ searchParams }: { searchParams: Params }) {
  const [items, materialItems, locationItems, editing] = await Promise.all([
    listBatches({
      date: searchParams.date,
      materialId: searchParams.materialId,
      materialName: searchParams.materialName,
      status: searchParams.status as never,
      supplier: searchParams.supplier,
      manufacturer: searchParams.manufacturer,
    }),
    listMaterials(),
    listLocations(),
    getBatchDetail(searchParams.edit),
  ]);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">批次管理</h1>
          <p className="mt-1 text-sm text-slate-500">每一批物料独立管理，库存由流转自动计算。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/materials/batches?new=1#batch-form">新建批次</Link>
        </Button>
      </div>

      <BatchFilters searchParams={searchParams} materials={materialItems} />

      {editing || searchParams.new === "1" ? (
        <BatchForm
          detail={editing}
          locations={locationItems}
          isEditing={Boolean(editing)}
        />
      ) : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((row) => (
            <Card key={row.batch.id}>
              <CardContent className="grid gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">{row.batch.batchCode}</Badge>
                    <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                      {statusLabels[row.batch.status]}
                    </Badge>
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-950">{row.material.name}</p>
                  <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                    <span>制作数量：{Number(row.batch.quantity).toFixed(2)} {row.material.unit}</span>
                    <span>当前剩余：{row.currentRemaining.toFixed(2)} {row.material.unit}</span>
                    <span>物料尺寸：{row.material.size || "未填写"}</span>
                    <span>仓库：{row.batch.supplier || "未填写"}</span>
                    <span>物料制作商：{row.batch.manufacturer || "未填写"}</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/materials/batches/${row.batch.id}`}>详情</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/materials/batches?edit=${row.batch.id}#batch-form`}>编辑</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="暂无批次" description="新增批次后即可记录发货、调拨和扣减。" />
      )}
    </div>
  );
}

function BatchFilters({
  searchParams,
  materials,
}: {
  searchParams: Params;
  materials: Awaited<ReturnType<typeof listMaterials>>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <form className="grid gap-3 md:grid-cols-[0.9fr_1fr_0.9fr_1fr_1fr_auto_auto]">
          <Input name="date" type="date" defaultValue={searchParams.date} />
          <Input name="materialName" defaultValue={searchParams.materialName} placeholder="物料名称" list="batch-filter-materials" />
          <datalist id="batch-filter-materials">
            {materials.map((material) => <option key={material.id} value={material.name} />)}
          </datalist>
          <Select name="status" defaultValue={searchParams.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="active">进行中</option>
            <option value="used_up">已用完</option>
            <option value="inactive">已停用</option>
          </Select>
          <Input name="supplier" defaultValue={searchParams.supplier} placeholder="仓库" />
          <Input name="manufacturer" defaultValue={searchParams.manufacturer} placeholder="物料制作商" />
          <Button type="submit" variant="secondary">
            <Search className="h-4 w-4" />
            筛选
          </Button>
          <Button asChild variant="ghost">
            <Link href="/materials/batches">清空</Link>
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BatchForm({
  detail,
  locations,
  isEditing,
}: {
  detail: Awaited<ReturnType<typeof getBatchDetail>>;
  locations: Awaited<ReturnType<typeof listLocations>>;
  isEditing: boolean;
}) {
  const batch = detail?.batch ?? null;
  const material = detail?.material ?? null;
  const defaultLocationId = locations.find((location) => location.name === "自己仓")?.id ?? locations[0]?.id ?? "";
  const initialLocationId = batch?.initialLocationId ?? defaultLocationId;

  return (
    <Card id="batch-form">
      <CardHeader>
        <CardTitle>{isEditing ? "编辑批次" : "新建批次"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveBatchAction} className="grid gap-4">
          <input type="hidden" name="id" value={batch?.id ?? ""} />
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="物料名称">
              <Input name="materialName" defaultValue={material?.name} placeholder="手动输入物料名称" required />
            </Field>
            <Field label="制作日期">
              <Input name="productionDate" type="date" defaultValue={String(batch?.productionDate ?? "")} required />
            </Field>
            <Field label="制作数量">
              <Input name="quantity" type="number" step="0.01" min="0" defaultValue={batch?.quantity} required />
            </Field>
            <Field label="单价">
              <Input name="price" type="number" step="0.01" min="0" defaultValue={batch?.price} />
            </Field>
            <Field label="仓库">
              <Input name="supplier" defaultValue={batch?.supplier} />
            </Field>
            <Field label="物料制作商">
              <Input name="manufacturer" defaultValue={batch?.manufacturer} />
            </Field>
            <Field label="初始地点">
              <Select name="initialLocationId" defaultValue={initialLocationId} required>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="状态">
              <Select name="status" defaultValue={batch?.status ?? "active"}>
                <option value="active">进行中</option>
                <option value="used_up">已用完</option>
                <option value="inactive">已停用</option>
              </Select>
            </Field>
          </div>
          <Field label="备注">
            <Textarea name="remark" defaultValue={batch?.remark} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton>{isEditing ? "保存修改" : "新建批次"}</SubmitButton>
            {isEditing ? (
              <Button asChild variant="outline">
                <Link href="/materials/batches">取消编辑</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
