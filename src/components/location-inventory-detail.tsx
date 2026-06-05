import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getLocationInventoryDetail } from "@/lib/data";

function formatInventoryNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

const statusLabels = {
  active: "进行中",
  used_up: "已用完 / 不再补货",
  inactive: "已停用 / 不再补货",
} as const;

const statusClasses = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  used_up: "border-slate-200 bg-slate-50 text-slate-600",
  inactive: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export async function LocationInventoryDetail({ id }: { id: string }) {
  const detail = await getLocationInventoryDetail(id);
  if (!detail) notFound();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">{detail.locationName}库存详情</h1>
          <p className="mt-1 text-sm text-slate-500">查看这个仓库当前有哪些物料、对应批次和简化来源说明。</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/materials">返回物料管理</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/locations">返回列表</Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-3 p-4 md:grid-cols-3 md:items-end">
          <div>
            <p className="text-sm text-slate-500">当前库存</p>
            <p className="mt-2 text-3xl font-semibold text-slate-950">
              {formatInventoryNumber(detail.totalStock)}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-500">地点类型</p>
            <Badge className="mt-2 border-slate-200 bg-slate-50 text-slate-600">
              {detail.locationType === "warehouse" ? "仓库" : "其他"}
            </Badge>
          </div>
          <div>
            <p className="text-sm text-slate-500">物料项数</p>
            <p className="mt-2 text-xl font-semibold text-slate-950">{detail.detailRows.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>物料明细</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {detail.detailRows.length ? (
            detail.detailRows.map((row) => (
              <div key={`${row.batchId}-${row.materialId}`} className="rounded-md border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{row.materialName}</p>
                    <div className="mt-2 grid gap-1 text-sm text-slate-500">
                      <p>当前数量：{formatInventoryNumber(row.quantity)}</p>
                      <p>批次：{row.batchCode}</p>
                      <p>来源：{row.sourceText}</p>
                      <p>
                        <Badge className={statusClasses[row.status]}>
                          {statusLabels[row.status]}
                        </Badge>
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/materials/batches/${row.batchId}`}>查看批次</Link>
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              当前这个仓库没有库存明细。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
