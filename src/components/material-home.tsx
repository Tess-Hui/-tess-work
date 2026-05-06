import Link from "next/link";
import { Download, Plus, Warehouse } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LocationStockVisualization } from "@/components/location-stock-visualization";
import { getMaterialHomeData } from "@/lib/data";
import { formatDate } from "@/lib/dates";

export async function MaterialHome() {
  const data = await getMaterialHomeData();

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">物料管理</h1>
          <p className="mt-1 text-sm text-slate-500">以批次为核心，查看库存、记录流转和导出明细。</p>
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
            <p className="mt-3 text-3xl font-semibold text-slate-950">{data.totalStock.toFixed(2)}</p>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Button asChild variant="secondary">
          <Link href="/materials/batches">
            <Warehouse className="h-4 w-4" />
            查看库存
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/locations">地点管理</Link>
        </Button>
      </section>

      <LocationStockVisualization title="各地点当前库存" items={data.locationStocks} />

      <Card>
        <CardHeader>
          <CardTitle>最近批次</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          {data.recentBatches.length ? (
            data.recentBatches.map((row) => (
              <Link
                key={row.batch.id}
                href={`/materials/batches/${row.batch.id}`}
                className="rounded-md border border-slate-200 p-3 hover:bg-slate-50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="border-slate-200 bg-slate-50 text-slate-600">{row.batch.batchCode}</Badge>
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">
                    剩余 {row.currentRemaining.toFixed(2)} {row.material.unit}
                  </Badge>
                </div>
                <p className="mt-2 font-medium text-slate-950">{row.material.name}</p>
                <p className="mt-1 text-sm text-slate-500">制作日期：{formatDate(row.batch.productionDate)}</p>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
              暂无批次，先新建一个物料和批次。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
