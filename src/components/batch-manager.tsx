import Link from "next/link";
import { Link2, Package, Search } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { InventoryItemBars, formatInventoryNumber } from "@/components/inventory-item-bars";
import {
  createLinkedStockInAction,
  createLinkedStockOutAction,
  createLinkedTransferAction,
  deleteBatchAction,
  operateBomAction,
  saveBatchAction,
} from "@/lib/actions";
import { getShanghaiDateString } from "@/lib/dates";
import {
  getBatchDetail,
  getInventoryLinkGroupDetail,
  getInventoryLinkBadgesForBatches,
  listBatchesWithBomMatches,
  listMaterialCategories,
  listMaterials,
  listWarehouseLocations,
} from "@/lib/data";

type Params = {
  date?: string;
  materialId?: string;
  materialName?: string;
  category?: string;
  status?: string;
  supplier?: string;
  edit?: string;
  new?: string;
  deleted?: string;
  bomError?: string;
  linkGroup?: string;
  linkMode?: string;
  linkError?: string;
  linkedTransfer?: string;
  linkedStockIn?: string;
  linkedConsume?: string;
  linkedReturn?: string;
};

type LinkMode = "transfer" | "stockIn" | "consume" | "return";

const statusLabels = {
  active: "进行中",
  used_up: "已用完",
  inactive: "已停用",
} as const;

const statusBadgeClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  used_up: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export async function BatchManager({ searchParams }: { searchParams: Params }) {
  const [batchData, materialItems, categoryItems, warehouseItems, editing, selectedLinkGroup] = await Promise.all([
    listBatchesWithBomMatches({
      date: searchParams.date,
      materialId: searchParams.materialId,
      materialName: searchParams.materialName,
      category: searchParams.category,
      status: searchParams.status as never,
      supplier: searchParams.supplier,
    }),
    listMaterials(),
    listMaterialCategories(),
    listWarehouseLocations(),
    getBatchDetail(searchParams.edit),
    getInventoryLinkGroupDetail(searchParams.linkGroup),
  ]);
  const items = batchData.batches;
  const linkGroupBadges = await getInventoryLinkBadgesForBatches(items);
  const showBomGroups = Boolean(searchParams.materialName?.trim() && batchData.bomGroups.length);
  const returnTo = batchReturnHref(searchParams);
  const selectedLinkMode = normalizeLinkMode(searchParams.linkMode);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料总库存</h1>
          <p className="mt-1 text-sm text-slate-500">按批次查看当前库存、仓库归属和流转状态。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/materials/batches?new=1#batch-form">新建批次</Link>
        </Button>
      </div>

      <BatchFilters searchParams={searchParams} materials={materialItems} categories={categoryItems} />

      {searchParams.deleted === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">已删除批次。</CardContent>
        </Card>
      ) : null}

      {searchParams.bomError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            BOM操作失败：{searchParams.bomError === "INSUFFICIENT_STOCK" ? "组成物料库存不足。" : "请检查操作数量和仓库。"}
          </CardContent>
        </Card>
      ) : null}

      {searchParams.linkError ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            联动操作失败：{linkErrorMessage(searchParams.linkError)}
          </CardContent>
        </Card>
      ) : null}

      {searchParams.linkedTransfer === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">联动调货已完成。</CardContent>
        </Card>
      ) : null}

      {searchParams.linkedStockIn === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">联动进货已完成。</CardContent>
        </Card>
      ) : null}

      {searchParams.linkedConsume === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">联动扣减库存已完成。</CardContent>
        </Card>
      ) : null}

      {searchParams.linkedReturn === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">联动退回已完成。</CardContent>
        </Card>
      ) : null}

      {editing || searchParams.new === "1" ? (
        <BatchForm
          detail={editing}
          categories={categoryItems}
          warehouseLocations={warehouseItems}
          isEditing={Boolean(editing)}
        />
      ) : null}

      {showBomGroups ? (
        <BomGroupSection
          groups={batchData.bomGroups}
          warehouses={warehouseItems}
          returnTo={returnTo}
        />
      ) : null}

      {selectedLinkGroup ? (
        <LinkedOperationPanel
          group={selectedLinkGroup}
          warehouses={warehouseItems}
          mode={selectedLinkMode}
          baseReturnTo={returnTo}
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
                    <Badge className={statusBadgeClasses[row.batch.status]}>
                      {statusLabels[row.batch.status]}
                    </Badge>
                    {row.batch.status !== "active" ? (
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                        不再补货
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-base font-semibold text-slate-950">{row.material.name}</p>
                  {linkGroupBadges.get(row.batch.id)?.length ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {linkGroupBadges.get(row.batch.id)?.map((group) => (
                        <Badge key={group.id} className="border-sky-200 bg-sky-50 text-sky-700">
                          已联动：{group.name}
                        </Badge>
                      ))}
                    </div>
                  ) : null}
                  <div className="mt-2 grid gap-1 text-sm text-slate-500 sm:grid-cols-2">
                    <span>制作数量：{Number(row.batch.quantity).toFixed(2)} {row.material.unit}</span>
                    <span>当前剩余：{row.currentRemaining.toFixed(2)} {row.material.unit}</span>
                    <span>物料尺寸：{row.material.size || "未填写"}</span>
                    <span>仓库：{row.batch.supplier || "未填写"}</span>
                  </div>
                  <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
                    <p className="mb-3 text-sm font-medium text-slate-700">仓库库存分布明细</p>
                    <InventoryItemBars
                      items={row.stockDistribution.map((stock) => ({
                        materialId: stock.location.id,
                        materialName: stock.location.name,
                        stock: stock.quantity,
                        status: stock.status,
                        activeStock: stock.status === "active" ? stock.quantity : 0,
                      }))}
                      limit={5}
                      detailHref={`/materials/batches/${row.batch.id}`}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {linkGroupBadges.get(row.batch.id)?.[0] ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={batchLinkGroupHref(searchParams, linkGroupBadges.get(row.batch.id)?.[0]?.id ?? "")}>
                        <Link2 className="h-4 w-4" />
                        联动
                      </Link>
                    </Button>
                  ) : null}
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/materials/batches/${row.batch.id}`}>详情</Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/materials/batches?edit=${row.batch.id}#batch-form`}>编辑</Link>
                  </Button>
                  <form action={deleteBatchAction}>
                    <input type="hidden" name="id" value={row.batch.id} />
                    <ConfirmDeleteButton />
                  </form>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={Package} title="暂无批次" description="新增批次后即可记录发货、调货和扣减。" />
      )}
    </div>
  );
}

function batchReturnHref(searchParams: Params) {
  const params = new URLSearchParams();
  if (searchParams.date) params.set("date", searchParams.date);
  if (searchParams.materialName) params.set("materialName", searchParams.materialName);
  if (searchParams.category) params.set("category", searchParams.category);
  if (searchParams.status) params.set("status", searchParams.status);
  if (searchParams.supplier) params.set("supplier", searchParams.supplier);
  const query = params.toString();
  return query ? `/materials/batches?${query}` : "/materials/batches";
}

function normalizeLinkMode(mode?: string): LinkMode {
  if (mode === "stockIn" || mode === "consume" || mode === "return") return mode;
  return "transfer";
}

function linkModeLabel(mode: LinkMode) {
  const labels = {
    transfer: "联动调货",
    stockIn: "联动进货",
    consume: "联动扣减库存",
    return: "联动退回",
  };
  return labels[mode];
}

function returnToWithLinkGroup(returnTo: string, groupId: string, mode: LinkMode = "transfer") {
  const separator = returnTo.includes("?") ? "&" : "?";
  return `${returnTo}${separator}linkGroup=${groupId}&linkMode=${mode}`;
}

function batchLinkGroupHref(searchParams: Params, groupId: string, mode: LinkMode = "transfer") {
  return returnToWithLinkGroup(batchReturnHref(searchParams), groupId, mode);
}

function linkErrorMessage(reason: string) {
  const labels: Record<string, string> = {
    INSUFFICIENT_STOCK: "组内某项来源仓库库存不足，整组没有执行。",
    LOCATION_REQUIRED: "请选择来源仓库和目标仓库。",
    SAME_LOCATION: "来源仓库和目标仓库不能相同。",
    NO_ITEMS: "请至少勾选一个项目并填写数量。",
    ITEM_NOT_IN_GROUP: "项目不属于当前联动组。",
    BATCH_REQUIRED: "请选择本次入库对应的批次。",
    BATCH_NOT_FOUND: "没有找到本次入库对应的批次。",
    BATCH_MATERIAL_MISMATCH: "选择的批次和联动项目不匹配。",
    INVALID_QUANTITY: "请填写大于 0 的数量。",
    INVALID_PRICE: "金额不能小于 0。",
  };
  return labels[reason] ?? "请检查仓库、数量和组内项目。";
}

function LinkedOperationPanel({
  group,
  warehouses,
  mode,
  baseReturnTo,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getInventoryLinkGroupDetail>>>;
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  mode: LinkMode;
  baseReturnTo: string;
}) {
  const returnTo = returnToWithLinkGroup(baseReturnTo, group.id, mode);
  const modes: LinkMode[] = ["transfer", "stockIn", "consume", "return"];

  return (
    <section className="grid gap-3" id="linked-operation">
      <Card className="border-sky-200">
        <CardHeader>
          <CardTitle>联动：{group.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {modes.map((item) => (
            <Button
              key={item}
              asChild
              variant={item === mode ? "default" : "secondary"}
              size="sm"
            >
              <Link href={returnToWithLinkGroup(baseReturnTo, group.id, item)}>
                {linkModeLabel(item)}
              </Link>
            </Button>
          ))}
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/links">维护联动组</Link>
          </Button>
        </CardContent>
      </Card>

      {mode === "transfer" ? (
        <LinkedTransferPanel group={group} warehouses={warehouses} returnTo={returnTo} />
      ) : null}
      {mode === "stockIn" ? (
        <LinkedStockInPanel group={group} warehouses={warehouses} returnTo={returnTo} />
      ) : null}
      {mode === "consume" || mode === "return" ? (
        <LinkedStockOutPanel group={group} warehouses={warehouses} returnTo={returnTo} mode={mode} />
      ) : null}
    </section>
  );
}

function LinkedTransferPanel({
  group,
  warehouses,
  returnTo,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getInventoryLinkGroupDetail>>>;
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  returnTo: string;
}) {
  return (
    <Card className="border-sky-200" id="linked-transfer">
      <CardHeader>
        <CardTitle>联动调货：{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLinkedTransferAction} className="grid gap-4">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 md:grid-cols-3">
            <Field label="调货日期">
              <Input name="date" type="date" defaultValue={getShanghaiDateString()} required />
            </Field>
            <Field label="来源仓库">
              <Select name="fromLocationId" required>
                <option value="">选择来源仓库</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="目标仓库">
              <Select name="toLocationId" required>
                <option value="">选择目标仓库</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-2">
            {group.items.length ? (
              group.items.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[auto_1fr_0.6fr] md:items-center">
                  <input type="hidden" name={`items[${index}].targetId`} value={item.targetId} />
                  <input type="hidden" name={`items[${index}].targetType`} value={item.targetType} />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      name={`items[${index}].enabled`}
                      defaultChecked={item.defaultEnabled}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    参与
                  </label>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">
                      {item.name}
                      {item.batchCode ? <span className="ml-2 text-sm font-normal text-slate-500">{item.batchCode}</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      当前进行中总库存：{item.activeStock.toFixed(2)} {item.unit}
                    </p>
                    {item.locations.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.locations.map((location) => (
                          <span
                            key={location.locationId}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            {location.locationName}：{location.stock.toFixed(2)} {item.unit}
                            {location.status !== "active" ? `（${statusLabels[location.status]}）` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">暂无仓库库存分布。</p>
                    )}
                  </div>
                  <Field label="本次调货数量">
                    <Input name={`items[${index}].quantity`} type="number" min="0" step="0.01" defaultValue="0" />
                  </Field>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                这个联动组还没有组内项目，请先到物料联动组页面添加。
              </p>
            )}
          </div>

          <Field label="备注">
            <Textarea name="remark" placeholder="可填写这次调货说明" />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton variant="secondary">执行整组调货</SubmitButton>
            <Button asChild variant="outline">
              <Link href="/materials/links">维护联动组</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LinkedStockInPanel({
  group,
  warehouses,
  returnTo,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getInventoryLinkGroupDetail>>>;
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  returnTo: string;
}) {
  return (
    <Card className="border-emerald-200" id="linked-stock-in">
      <CardHeader>
        <CardTitle>联动进货：{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLinkedStockInAction} className="grid gap-4">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="入库日期">
              <Input name="date" type="date" defaultValue={getShanghaiDateString()} required />
            </Field>
            <Field label="目标仓库">
              <Select name="toLocationId" required>
                <option value="">选择入库仓库</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-2">
            {group.items.length ? (
              group.items.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[auto_1fr_0.75fr_0.55fr_0.55fr] lg:items-center">
                  <input type="hidden" name={`items[${index}].targetId`} value={item.targetId} />
                  <input type="hidden" name={`items[${index}].targetType`} value={item.targetType} />
                  {item.targetType === "batch" ? (
                    <input type="hidden" name={`items[${index}].batchId`} value={item.targetId} />
                  ) : null}
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      name={`items[${index}].enabled`}
                      defaultChecked={item.defaultEnabled}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    参与
                  </label>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">
                      {item.name}
                      {item.batchCode ? <span className="ml-2 text-sm font-normal text-slate-500">{item.batchCode}</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      当前进行中总库存：{item.activeStock.toFixed(2)} {item.unit}
                    </p>
                  </div>
                  <Field label="入库批次">
                    {item.targetType === "batch" ? (
                      <Input value={item.batchCode ?? item.name} readOnly />
                    ) : (
                      <Select name={`items[${index}].batchId`} required defaultValue={item.batches[0]?.id ?? ""}>
                        <option value="">选择批次</option>
                        {item.batches.map((batch) => (
                          <option key={batch.id} value={batch.id}>
                            {batch.batchCode} · {batch.currentRemaining.toFixed(2)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="本次入库数量">
                    <Input name={`items[${index}].quantity`} type="number" min="0" step="0.01" defaultValue="0" />
                  </Field>
                  <Field label="金额">
                    <Input name={`items[${index}].movementTotalPrice`} type="number" min="0" step="0.01" placeholder="金额" defaultValue="0" />
                  </Field>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                这个联动组还没有组内项目，请先到物料联动组页面添加。
              </p>
            )}
          </div>

          <Field label="备注">
            <Textarea name="remark" placeholder="可填写这次入库说明" />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton variant="secondary">执行联动入库</SubmitButton>
            <Button asChild variant="outline">
              <Link href="/materials/links">维护联动组</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function LinkedStockOutPanel({
  group,
  warehouses,
  returnTo,
  mode,
}: {
  group: NonNullable<Awaited<ReturnType<typeof getInventoryLinkGroupDetail>>>;
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  returnTo: string;
  mode: "consume" | "return";
}) {
  const title = mode === "return" ? "联动退回" : "联动扣减库存";
  const locationLabel = mode === "return" ? "退回来源仓库" : "扣减仓库";
  const locationPlaceholder = mode === "return" ? "从哪个仓库退回" : "从哪个仓库扣减";

  return (
    <Card className="border-amber-200" id={`linked-${mode}`}>
      <CardHeader>
        <CardTitle>{title}：{group.name}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createLinkedStockOutAction} className="grid gap-4">
          <input type="hidden" name="groupId" value={group.id} />
          <input type="hidden" name="operation" value={mode} />
          <input type="hidden" name="returnTo" value={returnTo} />
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="日期">
              <Input name="date" type="date" defaultValue={getShanghaiDateString()} required />
            </Field>
            <Field label={locationLabel}>
              <Select name="fromLocationId" required>
                <option value="">{locationPlaceholder}</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-2">
            {group.items.length ? (
              group.items.map((item, index) => (
                <div key={item.id} className="grid gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 md:grid-cols-[auto_1fr_0.6fr] md:items-center">
                  <input type="hidden" name={`items[${index}].targetId`} value={item.targetId} />
                  <input type="hidden" name={`items[${index}].targetType`} value={item.targetType} />
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="checkbox"
                      name={`items[${index}].enabled`}
                      defaultChecked={item.defaultEnabled}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                    参与
                  </label>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">
                      {item.name}
                      {item.batchCode ? <span className="ml-2 text-sm font-normal text-slate-500">{item.batchCode}</span> : null}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      当前进行中总库存：{item.activeStock.toFixed(2)} {item.unit}
                    </p>
                    {item.locations.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.locations.map((location) => (
                          <span
                            key={location.locationId}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
                          >
                            {location.locationName}：{location.stock.toFixed(2)} {item.unit}
                            {location.status !== "active" ? `（${statusLabels[location.status]}）` : ""}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-slate-500">暂无仓库库存分布。</p>
                    )}
                  </div>
                  <Field label={mode === "return" ? "本次退回数量" : "本次扣减数量"}>
                    <Input name={`items[${index}].quantity`} type="number" min="0" step="0.01" defaultValue="0" />
                  </Field>
                </div>
              ))
            ) : (
              <p className="rounded-md border border-dashed border-slate-200 p-4 text-center text-sm text-slate-500">
                这个联动组还没有组内项目，请先到物料联动组页面添加。
              </p>
            )}
          </div>

          <Field label="备注">
            <Textarea name="remark" placeholder={mode === "return" ? "可填写这次退回说明" : "可填写这次扣减说明"} />
          </Field>
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton variant="secondary">执行{title}</SubmitButton>
            <Button asChild variant="outline">
              <Link href="/materials/links">维护联动组</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function BomGroupSection({
  groups,
  warehouses,
  returnTo,
}: {
  groups: Awaited<ReturnType<typeof listBatchesWithBomMatches>>["bomGroups"];
  warehouses: Awaited<ReturnType<typeof listWarehouseLocations>>;
  returnTo: string;
}) {
  return (
    <section className="grid gap-3" aria-label="BOM组合结果">
      <div>
        <h2 className="text-lg font-semibold text-slate-950">BOM组合结果</h2>
        <p className="mt-1 text-sm text-slate-500">搜索命中的成品和组成物料会一起显示，可整组发货、调货或停用。</p>
      </div>
      {groups.map((group) => (
        <Card key={group.parent.id} className="border-emerald-200">
          <CardContent className="grid gap-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">BOM组合</Badge>
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">{group.parent.category || "未分类"}</Badge>
                </div>
                <h3 className="mt-2 text-base font-semibold text-slate-950">{group.parent.name}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  可组装数量：<span className="font-semibold text-slate-950">{formatInventoryNumber(group.availableQuantity)}</span>
                </p>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href={`/materials/items?edit=${group.parent.id}#bom`}>维护BOM</Link>
              </Button>
            </div>

            <div className="grid gap-2">
              {group.children.map((child) => (
                <div key={child.bomId} className="rounded-md border border-slate-200 bg-slate-50 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-medium text-slate-950">{child.materialName}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        单件用量：{formatInventoryNumber(child.quantityPerParent)} {child.unit || "单位"}
                        <span className="mx-2">·</span>
                        进行中库存：{formatInventoryNumber(child.activeStock)} {child.unit}
                      </p>
                    </div>
                    {child.quantityPerParent > 0 && child.activeStock / child.quantityPerParent <= 50 ? (
                      <Badge className="border-red-200 bg-red-50 text-red-700">组合库存偏低</Badge>
                    ) : null}
                  </div>
                  {child.locations.length ? (
                    <div className="mt-3 grid gap-1 text-sm text-slate-600 sm:grid-cols-2 lg:grid-cols-3">
                      {child.locations.map((location) => (
                        <span key={location.locationId}>
                          {location.locationName}：{formatInventoryNumber(location.stock)}
                          {location.status !== "active" ? `（${statusLabels[location.status]}）` : ""}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">暂无仓库库存。</p>
                  )}
                </div>
              ))}
            </div>

            <form action={operateBomAction} className="grid gap-3 lg:grid-cols-[0.8fr_0.8fr_0.8fr_0.7fr_auto] lg:items-end">
              <input type="hidden" name="parentMaterialId" value={group.parent.id} />
              <input type="hidden" name="returnTo" value={returnTo} />
              <Field label="联动操作">
                <Select name="operation" defaultValue="consume">
                  <option value="consume">一键发货 / 出库</option>
                  <option value="transfer">一键调货</option>
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
                  <option value="">仅调货时选择</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="成品数量">
                <Input name="quantity" type="number" min="0" step="0.01" defaultValue="1" />
              </Field>
              <SubmitButton variant="secondary">执行联动</SubmitButton>
            </form>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

function BatchFilters({
  searchParams,
  materials,
  categories,
}: {
  searchParams: Params;
  materials: Awaited<ReturnType<typeof listMaterials>>;
  categories: Awaited<ReturnType<typeof listMaterialCategories>>;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-3 flex flex-wrap gap-2">
          <Button
            asChild
            size="sm"
            variant="secondary"
            className={!searchParams.category ? "bg-slate-950 !text-white hover:bg-slate-800 hover:!text-white [&_*]:!text-white" : ""}
          >
            <Link href="/materials/batches">全部分类</Link>
          </Button>
          {categories.slice(0, 8).map((category) => (
            <Button
              key={category}
              asChild
              size="sm"
              variant="secondary"
              className={searchParams.category === category ? "bg-slate-950 !text-white hover:bg-slate-800 hover:!text-white [&_*]:!text-white" : ""}
            >
              <Link href={`/materials/batches?category=${encodeURIComponent(category)}`}>{category}</Link>
            </Button>
          ))}
        </div>
        <form className="grid gap-3 md:grid-cols-[0.9fr_1fr_0.8fr_0.9fr_1fr_auto_auto]">
          <Input name="date" type="date" defaultValue={searchParams.date} />
          <Input name="materialName" defaultValue={searchParams.materialName} placeholder="物料名称" list="batch-filter-materials" />
          <datalist id="batch-filter-materials">
            {materials.map((material) => <option key={material.id} value={material.name} />)}
          </datalist>
          <Select name="category" defaultValue={searchParams.category ?? "all"}>
            <option value="all">全部分类</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Select>
          <Select name="status" defaultValue={searchParams.status ?? "all"}>
            <option value="all">全部状态</option>
            <option value="active">进行中</option>
            <option value="used_up">已用完</option>
            <option value="inactive">已停用</option>
          </Select>
          <Input name="supplier" defaultValue={searchParams.supplier} placeholder="仓库" />
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
  categories,
  warehouseLocations,
  isEditing,
}: {
  detail: Awaited<ReturnType<typeof getBatchDetail>>;
  categories: Awaited<ReturnType<typeof listMaterialCategories>>;
  warehouseLocations: Awaited<ReturnType<typeof listWarehouseLocations>>;
  isEditing: boolean;
}) {
  const batch = detail?.batch ?? null;
  const material = detail?.material ?? null;
  const defaultWarehouseId =
    warehouseLocations.find((location) => location.name === "自己仓")?.id
    ?? warehouseLocations[0]?.id
    ?? "";
  const warehouseLocationId =
    warehouseLocations.find((location) => location.name === batch?.supplier)?.id
    ?? detail?.initialLocation.id
    ?? defaultWarehouseId;

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
            <Field label="物料分类">
              <Select name="materialCategory" defaultValue={material?.category || "未分类"}>
                {[...new Set([material?.category, ...categories, "未分类"].filter(Boolean))].map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </Select>
            </Field>
            <Field label="制作日期">
              <Input name="productionDate" type="date" defaultValue={String(batch?.productionDate ?? "")} required />
            </Field>
            <Field label="制作数量">
              <Input name="quantity" type="number" step="0.01" min="0" defaultValue={batch?.quantity} required />
            </Field>
            <Field label="总价">
              <Input
                name="totalPrice"
                type="number"
                step="0.01"
                min="0"
                defaultValue={batch?.totalPrice}
                placeholder="请输入这一批总价"
              />
            </Field>
            <Field label="仓库">
              <Select name="warehouseLocationId" defaultValue={warehouseLocationId} required>
                {warehouseLocations.map((location) => (
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
