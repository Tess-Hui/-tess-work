import Link from "next/link";

type InventoryItem = {
  materialId?: string;
  materialName: string;
  stock: number;
};

const LOW_STOCK_THRESHOLD = 50;

export function formatInventoryNumber(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getStockState(stock: number) {
  if (stock <= 0) {
    return {
      label: "已无库存",
      barClassName: "bg-rose-500",
      textClassName: "text-rose-600",
    };
  }

  if (stock <= LOW_STOCK_THRESHOLD) {
    return {
      label: "库存告急",
      barClassName: "bg-red-500",
      textClassName: "text-red-600",
    };
  }

  return {
    label: "",
    barClassName: "bg-emerald-500",
    textClassName: "text-slate-950",
  };
}

export function InventoryItemBars({
  items,
  limit,
  detailHref,
}: {
  items: InventoryItem[];
  limit?: number;
  detailHref?: string;
}) {
  const visibleItems = typeof limit === "number" ? items.slice(0, limit) : items;
  const remainingCount = typeof limit === "number" ? Math.max(0, items.length - visibleItems.length) : 0;
  const maxStock = Math.max(...visibleItems.map((item) => item.stock), ...items.map((item) => item.stock), 0);

  if (!items.length) {
    return <p className="text-xs text-slate-500">暂无库存明细</p>;
  }

  return (
    <div className="grid gap-3">
      {visibleItems.map((item) => {
        const state = getStockState(item.stock);
        const width = maxStock > 0 && item.stock > 0
          ? Math.max(4, Math.round((item.stock / maxStock) * 100))
          : 3;

        return (
          <div key={`${item.materialId ?? item.materialName}-${item.materialName}`} className="grid gap-1.5">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <p className="min-w-0 flex-1 break-words text-sm font-medium text-slate-700">
                {item.materialName}
              </p>
              <div className="shrink-0 text-right">
                <p className={`text-sm font-semibold ${state.textClassName}`}>
                  {formatInventoryNumber(item.stock)}
                </p>
                {state.label ? <p className="text-xs font-medium text-red-600">{state.label}</p> : null}
              </div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${state.barClassName}`}
                style={{ width: `${width}%` }}
              />
            </div>
          </div>
        );
      })}

      {remainingCount ? (
        detailHref ? (
          <Link href={detailHref} className="text-xs font-medium text-emerald-700 hover:text-emerald-800">
            还有 {remainingCount} 项，点击查看详情
          </Link>
        ) : (
          <p className="text-xs font-medium text-emerald-700">还有 {remainingCount} 项，点击查看详情</p>
        )
      ) : null}
    </div>
  );
}
