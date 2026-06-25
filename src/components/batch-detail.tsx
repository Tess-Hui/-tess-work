import Link from "next/link";
import { notFound } from "next/navigation";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createMovementAction,
  deleteBatchAction,
  deleteMovementAction,
  updateMovementAction,
} from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getBatchDetail } from "@/lib/data";

const movementLabels = {
  OUT: "发货",
  TRANSFER: "调货",
  RETURN: "退回",
  SCRAP: "报废",
  CONSUME: "扣减",
  STOCK_IN: "增加库存",
} as const;

const statusLabels = {
  active: "进行中",
  used_up: "已用完",
  inactive: "已停用",
} as const;

const LOW_STOCK_THRESHOLD = 50;

function formatQuantity(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function stockBarWidth(quantity: number, maxQuantity: number) {
  if (quantity <= 0 || maxQuantity <= 0) return "0%";
  return `${Math.max(4, Math.min(100, (quantity / maxQuantity) * 100))}%`;
}

function isLowStock(quantity: number) {
  return quantity > 0 && quantity <= LOW_STOCK_THRESHOLD;
}

function movementBadgeClass(type: keyof typeof movementLabels) {
  switch (type) {
    case "OUT":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "TRANSFER":
      return "border-indigo-200 bg-indigo-50 text-indigo-700";
    case "RETURN":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "STOCK_IN":
      return "border-green-200 bg-green-50 text-green-700";
    case "SCRAP":
    case "CONSUME":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

function statusBadgeClass(status: keyof typeof statusLabels) {
  if (status === "active") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-slate-200 bg-slate-50 text-slate-600";
}

export async function BatchDetail({
  id,
  error,
  deletedMovement,
  editMovementId,
}: {
  id: string;
  error?: string;
  deletedMovement?: string;
  editMovementId?: string;
}) {
  const detail = await getBatchDetail(id);
  if (!detail) notFound();
  const quantity = Number(detail.batch.quantity);
  const originalTotalPrice = Number(detail.batch.totalPrice);
  const stockInMovements = detail.movements.filter((movement) => movement.type === "STOCK_IN");
  const stockInQuantity = stockInMovements.reduce(
    (sum, movement) => sum + Number(movement.quantity),
    0,
  );
  const stockInTotalPrice = stockInMovements.reduce(
    (sum, movement) => sum + Number(movement.totalPrice ?? 0),
    0,
  );
  const cumulativeQuantity = quantity + stockInQuantity;
  const cumulativeTotalPrice = originalTotalPrice + stockInTotalPrice;
  const averageUnitPrice =
    cumulativeQuantity > 0 && Number.isFinite(cumulativeTotalPrice)
      ? cumulativeTotalPrice / cumulativeQuantity
      : 0;
  const maxDistributionQuantity = Math.max(
    0,
    ...detail.stockDistribution.map((item) => item.quantity),
  );

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border-slate-200 bg-slate-50 text-slate-600">{detail.batch.batchCode}</Badge>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
              {statusLabels[detail.batch.status]}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-slate-950">{detail.material.name}</h1>
          <p className="mt-1 text-sm text-slate-500">批次详情、库存分布和流转时间线。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/materials/batches">返回批次列表</Link>
          </Button>
          <form action={deleteBatchAction}>
            <input type="hidden" name="id" value={detail.batch.id} />
            <ConfirmDeleteButton triggerText="删除批次" />
          </form>
        </div>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            {error === "INSUFFICIENT_STOCK" ? "库存不足，无法扣减。" : "操作失败，请检查填写内容。"}
          </CardContent>
        </Card>
      ) : null}

      {deletedMovement === "1" ? (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-4 text-sm text-emerald-700">已删除流转记录。</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>批次信息</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-slate-600 md:grid-cols-3">
          <span>制作数量：{Number(detail.batch.quantity).toFixed(2)} {detail.material.unit}</span>
          <span>当前剩余：{detail.currentRemaining.toFixed(2)} {detail.material.unit}</span>
          <span>制作日期：{formatDate(detail.batch.productionDate)}</span>
          <span>物料类型：{detail.material.type || "未填写"}</span>
          <span>物料尺寸：{detail.material.size || "未填写"}</span>
          <span>单位：{detail.material.unit || "未填写"}</span>
          <span>原始总价：{formatMoney(originalTotalPrice)}</span>
          <span>增加库存总价：{formatMoney(stockInTotalPrice)}</span>
          <span>累计总价：{formatMoney(cumulativeTotalPrice)}</span>
          <span>平均单价：{formatMoney(averageUnitPrice)}</span>
          <span>仓库：{detail.batch.supplier || "未填写"}</span>
          <span>创建：{formatDateTime(detail.batch.createdAt)}</span>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>当前库存分布</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {detail.stockDistribution.length ? (
            detail.stockDistribution.map((item) => (
              <div key={item.location.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-950">{item.location.name}</p>
                    <p className="mt-1 text-xs text-slate-500">当前库存</p>
                    <Badge className={`mt-2 ${statusBadgeClass(item.status)}`}>
                      {statusLabels[item.status]}
                    </Badge>
                  </div>
                  {item.status === "active" && isLowStock(item.quantity) ? (
                    <span className="shrink-0 rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">
                      库存告急
                    </span>
                  ) : null}
                </div>
                <p className={`mt-2 text-2xl font-semibold ${item.status === "active" && isLowStock(item.quantity) ? "text-red-700" : "text-slate-950"}`}>
                  {formatQuantity(item.quantity)} {detail.material.unit}
                </p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${item.status === "active" && isLowStock(item.quantity) ? "bg-red-500" : "bg-emerald-500"}`}
                    style={{ width: stockBarWidth(item.quantity, maxDistributionQuantity) }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">当前没有库存。</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>流转记录</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {detail.movements.length ? (
            detail.movements.map((movement) => {
              const from = detail.locations.find((location) => location.id === movement.fromLocationId);
              const to = detail.locations.find((location) => location.id === movement.toLocationId);
              const direction =
                movement.type === "STOCK_IN"
                  ? `新增库存 → ${to?.name ?? "未选择仓库"}`
                  : movement.type === "CONSUME" || movement.type === "SCRAP"
                    ? `${from?.name ?? "无"} → 已扣减`
                    : `${from?.name ?? "无"} → ${to?.name ?? "无"}`;
              const movementQuantity = Number(movement.quantity);
              const movementTotalPrice = Number(movement.totalPrice ?? 0);
              const movementUnitPrice =
                movementQuantity > 0 && Number.isFinite(movementTotalPrice)
                  ? movementTotalPrice / movementQuantity
                  : 0;
              return (
                <div key={movement.id} className="grid gap-3 rounded-md border border-slate-200 p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={movementBadgeClass(movement.type)}>
                          {movementLabels[movement.type]}
                        </Badge>
                        <span className="text-sm text-slate-500">{formatDate(movement.date)}</span>
                      </div>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {direction}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        数量：
                        <span className="font-semibold text-slate-950">
                          {formatQuantity(movementQuantity)} {detail.material.unit}
                        </span>
                      </p>
                      {movement.type === "STOCK_IN" ? (
                        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                          <span>
                            总价：
                            <span className="font-semibold text-slate-950">
                              {formatMoney(movementTotalPrice)}
                            </span>
                          </span>
                          <span>
                            单价：
                            <span className="font-semibold text-slate-950">
                              {formatMoney(movementUnitPrice)}
                            </span>
                          </span>
                        </div>
                      ) : null}
                      {movement.remark ? <p className="mt-1 text-sm text-slate-500">{movement.remark}</p> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/materials/batches/${detail.batch.id}?editMovement=${movement.id}#movement-${movement.id}`}>
                          修改
                        </Link>
                      </Button>
                      <form action={deleteMovementAction}>
                        <input type="hidden" name="id" value={movement.id} />
                        <input type="hidden" name="batchId" value={detail.batch.id} />
                        <ConfirmDeleteButton
                          title="确定要删除这条流转记录吗？"
                          description="删除后，库存会自动重新计算。"
                          triggerText="删除"
                        />
                      </form>
                    </div>
                  </div>
                  {editMovementId === movement.id ? (
                    <div id={`movement-${movement.id}`} className="rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
                      <MovementForm
                        batchId={detail.batch.id}
                        title={`修改${movementLabels[movement.type]}`}
                        type={movement.type}
                        locations={detail.locations}
                        mode={movementMode(movement.type)}
                        movement={movement}
                        submitLabel="保存修改"
                        action={updateMovementAction}
                        cancelHref={`/materials/batches/${detail.batch.id}`}
                        toPlaceholder={movement.type === "STOCK_IN" ? "增加到哪个仓库" : "到哪里"}
                      />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              暂无流转记录。
            </p>
          )}
        </CardContent>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <MovementForm batchId={id} title="发货" type="OUT" locations={detail.locations} mode="to" />
        <MovementForm batchId={id} title="调货" type="TRANSFER" locations={detail.locations} mode="from-to" />
        <MovementForm batchId={id} title="退回" type="RETURN" locations={detail.locations} mode="from" />
        <MovementForm batchId={id} title="扣减" type="CONSUME" locations={detail.locations} mode="location" />
        <MovementForm
          batchId={id}
          title="增加库存"
          type="STOCK_IN"
          locations={detail.locations}
          mode="to"
          toPlaceholder="增加到哪个仓库"
        />
      </section>
    </div>
  );
}

function MovementForm({
  batchId,
  title,
  type,
  locations,
  mode,
  toPlaceholder = "到哪里",
  movement,
  submitLabel,
  action = createMovementAction,
  cancelHref,
}: {
  batchId: string;
  title: string;
  type: keyof typeof movementLabels;
  locations: NonNullable<Awaited<ReturnType<typeof getBatchDetail>>>["locations"];
  mode: "to" | "from-to" | "from" | "location";
  toPlaceholder?: string;
  movement?: NonNullable<Awaited<ReturnType<typeof getBatchDetail>>>["movements"][number];
  submitLabel?: string;
  action?: typeof createMovementAction | typeof updateMovementAction;
  cancelHref?: string;
}) {
  return (
    <Card className={movement ? "border-0 bg-transparent shadow-none" : undefined}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid min-w-0 gap-2">
          {movement ? <input type="hidden" name="id" value={movement.id} /> : null}
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="type" value={type} />
          <Input name="date" type="date" defaultValue={String(movement?.date ?? "")} />
          {mode === "from-to" || mode === "from" ? (
            <Select name="fromLocationId" required defaultValue={movement?.fromLocationId ?? ""}>
              <option value="">从哪里</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          {mode === "from-to" || mode === "to" ? (
            <Select name="toLocationId" required defaultValue={movement?.toLocationId ?? ""}>
              <option value="">{toPlaceholder}</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          {mode === "location" ? (
            <Select name="locationId" required defaultValue={movement?.fromLocationId ?? ""}>
              <option value="">扣减地点</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          <Input
            name="quantity"
            type="number"
            step="0.01"
            min="0"
            placeholder="数量"
            defaultValue={movement?.quantity}
            required
          />
          {type === "STOCK_IN" ? (
            <Input
              name="movementTotalPrice"
              type="number"
              step="0.01"
              min="0"
              placeholder="请输入本次增加库存的总价"
              defaultValue={movement?.totalPrice ?? ""}
              required
            />
          ) : null}
          <Textarea name="remark" placeholder="备注" defaultValue={movement?.remark} />
          <div className="flex flex-col gap-2 sm:flex-row">
            <SubmitButton size="sm">{submitLabel ?? title}</SubmitButton>
            {cancelHref ? (
              <Button asChild variant="outline" size="sm">
                <Link href={cancelHref}>取消</Link>
              </Button>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function movementMode(type: keyof typeof movementLabels) {
  if (type === "TRANSFER") return "from-to";
  if (type === "RETURN") return "from";
  if (type === "CONSUME" || type === "SCRAP") return "location";
  return "to";
}
