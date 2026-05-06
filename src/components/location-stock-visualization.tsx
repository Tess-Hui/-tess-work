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

            return (
              <Link
                key={item.locationId}
                href="/locations"
                className="rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{item.locationName}</p>
                    {!compact && previewItems.length ? (
                      <p className="mt-1 text-xs text-slate-500">
                        {previewItems
                          .map((preview) => `${preview.materialName} ${preview.stock.toFixed(2)}`)
                          .join(" / ")}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-950">
                    {item.totalStock.toFixed(2)}
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
