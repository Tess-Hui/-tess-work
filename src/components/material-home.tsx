import Link from "next/link";
import { Download, Link2, Plus, Tags, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InventoryItemBars, formatInventoryNumber } from "@/components/inventory-item-bars";
import { LocationStockVisualization } from "@/components/location-stock-visualization";
import { getMaterialHomeData } from "@/lib/data";

export async function MaterialHome() {
  const data = await getMaterialHomeData();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料管理</h1>
          <p className="mt-1 text-sm text-slate-500">以批次为核心，管理库存、记录流转和导出明细。</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="secondary">
            <Link href="/materials/batches?new=1#batch-form">
              <Plus className="h-4 w-4" />
              新建批次
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/export">
              <Download className="h-4 w-4" />
              导出
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">批次数量</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{data.batchCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">当前库存汇总</p>
            <p className="mt-3 text-3xl font-semibold text-slate-950">{formatInventoryNumber(data.totalStock)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button asChild variant="secondary">
          <Link href="/materials/batches">
            <Warehouse className="h-4 w-4" />
            物料总库存
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/locations">各仓库库存分布</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/materials/links">
            <Link2 className="h-4 w-4" />
            物料联动组
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/materials/categories">
            <Tags className="h-4 w-4" />
            物料分类
          </Link>
        </Button>
      </section>

      <LocationStockVisualization title="各仓库当前库存" items={data.locationStocks} />

      <Card>
        <CardHeader>
          <CardTitle>库存告急提醒</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.lowStockAlerts.length ? (
            <>
            {data.lowStockAlerts.slice(0, 10).map((alert) => (
              <Link
                key={`${alert.locationId}-${alert.materialId}-${alert.materialName}`}
                href={`/locations/${alert.locationId}/inventory`}
                className="rounded-md border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-red-200 bg-red-50 text-red-700">
                        {alert.stock <= 0 ? "已清零 / 需补货" : "库存告急"}
                      </Badge>
                      <Badge className="border-slate-200 bg-slate-50 text-slate-600">
                        仓库：{alert.locationName}
                      </Badge>
                    </div>
                    <p className="mt-2 font-medium text-slate-950">{alert.materialName}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-red-600">
                    当前库存：{formatInventoryNumber(alert.stock)}
                  </p>
                </div>
                <div className="mt-3">
                  <InventoryItemBars items={[{ materialName: alert.materialName, stock: alert.stock }]} />
                </div>
              </Link>
            ))}
            {data.lowStockAlerts.length > 10 ? (
              <Link href="/locations" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                还有 {data.lowStockAlerts.length - 10} 条库存告急，点击查看全部
              </Link>
            ) : null}
            </>
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              暂无库存告急物料。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
