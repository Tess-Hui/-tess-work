import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/dates";

type InventoryItem = {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  latestUsedAt: string | Date | null;
};

export function InventoryVisualization({
  title,
  items,
  compact = false,
}: {
  title: string;
  items: InventoryItem[];
  compact?: boolean;
}) {
  const maxStock = Math.max(...items.map((item) => item.currentStock), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {items.length ? (
          items.map((item) => {
            const width = maxStock > 0 ? Math.max(6, Math.round((item.currentStock / maxStock) * 100)) : 0;
            return (
              <Link
                key={item.id}
                href="/materials/items"
                className="rounded-md border border-slate-200 p-3 transition-colors hover:bg-slate-50"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-950">{item.name}</p>
                    {!compact ? (
                      <p className="mt-1 text-xs text-slate-500">
                        最近使用：{item.latestUsedAt ? formatDate(item.latestUsedAt) : "暂无"}
                      </p>
                    ) : null}
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-950">
                    {item.currentStock.toFixed(2)} {item.unit}
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
            暂无库存数据。
          </p>
        )}
      </CardContent>
    </Card>
  );
}
