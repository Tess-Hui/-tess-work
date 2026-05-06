import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type LocationStockItem = {
  locationId: string;
  locationName: string;
  totalStock: number;
  items: Array<{
    materialId: string;
    materialName: string;
    stock: number;
  }>;
};

function formatInventoryNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function LocationStockVisualization({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: LocationStockItem[];
  compact?: boolean;
}) {
  const maxStock = Math.max(...items.map((item) => item.totalStock), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length ? (
          items.map((item) => {
            const width = maxStock > 0 ? Math.max(6, Math.round((item.totalStock / maxStock) * 100)) : 0;
            const previewItems = compact ? [] : item.items.slice(0, 3);
            const remainingCount = compact ? 0 : Math.max(0, item.items.length - previewItems.length);

            return (
              <Link
                key={item.locationId}
                href={`/locations/${item.locationId}/inventory`}
                className="rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{item.locationName}</p>
                    {!compact && previewItems.length ? (
                      <div className="mt-2 grid gap-1 text-xs text-slate-500">
                        {previewItems.map((preview) => (
                          <p key={`${item.locationId}-${preview.materialId}-${preview.materialName}`}>
                            {preview.materialName} {formatInventoryNumber(preview.stock)}
                          </p>
                        ))}
                        {remainingCount ? (
                          <p className="text-emerald-700">还有 {remainingCount} 项，点击查看详情</p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-950">
                    {formatInventoryNumber(item.totalStock)}
                  </p>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </Link>
            );
          })
        ) : (
          <p className="rounded-md border border-dashed border-slate-200 p-6 text-center text-sm text-slate-500">
            暂无地点库存数据。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
