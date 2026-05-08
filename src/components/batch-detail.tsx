import Link from "next/link";
import { notFound } from "next/navigation";

import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createMovementAction } from "@/lib/actions";
import { formatDate, formatDateTime } from "@/lib/dates";
import { getBatchDetail } from "@/lib/data";

const movementLabels = {
  OUT: "发货",
  TRANSFER: "调货",
  RETURN: "退回",
  SCRAP: "报废",
  CONSUME: "扣减",
} as const;

const statusLabels = {
  active: "进行中",
  used_up: "已用完",
  inactive: "已停用",
} as const;

export async function BatchDetail({ id, error }: { id: string; error?: string }) {
  const detail = await getBatchDetail(id);
  if (!detail) notFound();

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
        <Button asChild variant="outline">
          <Link href="/materials/batches">返回批次列表</Link>
        </Button>
      </div>

      {error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">
            {error === "INSUFFICIENT_STOCK" ? "库存不足，无法扣减。" : "操作失败，请检查填写内容。"}
          </CardContent>
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
          <span>单价：{Number(detail.batch.price).toFixed(2)}</span>
          <span>总价：{Number(detail.batch.totalPrice).toFixed(2)}</span>
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
                <p className="font-medium text-slate-950">{item.location.name}</p>
                <p className="mt-2 text-2xl font-semibold text-slate-950">
                  {item.quantity.toFixed(2)} {detail.material.unit}
                </p>
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
              return (
                <div key={movement.id} className="rounded-md border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                      {movementLabels[movement.type]}
                    </Badge>
                    <span className="text-sm text-slate-500">{formatDate(movement.date)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {from?.name ?? "无"} → {to?.name ?? "无"}，数量 {Number(movement.quantity).toFixed(2)} {detail.material.unit}
                  </p>
                  {movement.remark ? <p className="mt-1 text-sm text-slate-500">{movement.remark}</p> : null}
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

      <section className="grid gap-3 md:grid-cols-4">
        <MovementForm batchId={id} title="发货" type="OUT" locations={detail.locations} mode="to" />
        <MovementForm batchId={id} title="调货" type="TRANSFER" locations={detail.locations} mode="from-to" />
        <MovementForm batchId={id} title="退回" type="RETURN" locations={detail.locations} mode="from" />
        <MovementForm batchId={id} title="扣减" type="CONSUME" locations={detail.locations} mode="location" />
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
}: {
  batchId: string;
  title: string;
  type: keyof typeof movementLabels;
  locations: NonNullable<Awaited<ReturnType<typeof getBatchDetail>>>["locations"];
  mode: "to" | "from-to" | "from" | "location";
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={createMovementAction} className="grid min-w-0 gap-2">
          <input type="hidden" name="batchId" value={batchId} />
          <input type="hidden" name="type" value={type} />
          <Input name="date" type="date" />
          {mode === "from-to" || mode === "from" ? (
            <Select name="fromLocationId" required>
              <option value="">从哪里</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          {mode === "from-to" || mode === "to" ? (
            <Select name="toLocationId" required>
              <option value="">到哪里</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          {mode === "location" ? (
            <Select name="locationId" required>
              <option value="">扣减地点</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </Select>
          ) : null}
          <Input name="quantity" type="number" step="0.01" min="0" placeholder="数量" required />
          <Textarea name="remark" placeholder="备注" />
          <SubmitButton size="sm">{title}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
