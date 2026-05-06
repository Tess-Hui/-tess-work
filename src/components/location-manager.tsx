import type { ReactNode } from "react";
import Link from "next/link";
import { MapPin, Pencil, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { SubmitButton } from "@/components/submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { deleteLocationAction, saveLocationAction } from "@/lib/actions";
import { getWarehouseStockSummary, listLocations } from "@/lib/data";

type Params = { edit?: string; new?: string; error?: string; type?: string };

const typeLabels = {
  warehouse: "仓库",
  factory: "物料制作商",
  other: "其他",
} as const;

export async function LocationManager({ searchParams }: { searchParams: Params }) {
  const [items, warehouseSummary] = await Promise.all([listLocations(), getWarehouseStockSummary()]);
  const editing = items.find((item) => item.id === searchParams.edit) ?? null;
  const activeType =
    searchParams.type === "warehouse" || searchParams.type === "factory" || searchParams.type === "other"
      ? searchParams.type
      : "all";
  const locationByName = new Map(items.map((location) => [location.name, location]));
  const warehouseCards = new Map(
    warehouseSummary.map((summary) => [
      summary.locationName,
      {
        name: summary.locationName,
        type: "warehouse" as const,
        stock: summary.totalStock,
        items: summary.items,
        location: locationByName.get(summary.locationName) ?? null,
      },
    ]),
  );

  for (const location of items.filter((item) => item.type === "warehouse")) {
    if (!warehouseCards.has(location.name)) {
      warehouseCards.set(location.name, {
        name: location.name,
        type: "warehouse" as const,
        stock: 0,
        items: [],
        location,
      });
    }
  }

  const warehouseItems = [...warehouseCards.values()].sort(
    (a, b) => b.stock - a.stock || a.name.localeCompare(b.name, "zh-Hans-CN"),
  );
  const otherLocationItems = items.filter((location) => location.type !== "warehouse");

  const filteredCards =
    activeType === "warehouse"
      ? warehouseItems
      : activeType === "all"
        ? [
            ...warehouseItems,
            ...otherLocationItems.map((location) => ({
              name: location.name,
              type: location.type,
              stock: warehouseCards.get(location.name)?.stock ?? 0,
              items: warehouseCards.get(location.name)?.items ?? [],
              location,
            })),
          ]
        : otherLocationItems
            .filter((location) => location.type === activeType)
            .map((location) => ({
              name: location.name,
              type: location.type,
              stock: warehouseCards.get(location.name)?.stock ?? 0,
              items: warehouseCards.get(location.name)?.items ?? [],
              location,
            }));

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">地点管理</h1>
          <p className="mt-1 text-sm text-slate-500">默认只有自己仓，物料制作商或其他地点可自行新增。</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/locations?new=1#location-form">新增地点</Link>
        </Button>
      </div>

      {searchParams.error === "in-use" ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-700">该地点已有批次或流转记录，不能删除。</CardContent>
        </Card>
      ) : null}

      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap gap-2">
            <FilterButton href="/locations" active={activeType === "all"}>
              全部
            </FilterButton>
            <FilterButton href="/locations?type=warehouse" active={activeType === "warehouse"}>
              仓库
            </FilterButton>
            <FilterButton href="/locations?type=factory" active={activeType === "factory"}>
              物料制作商
            </FilterButton>
            <FilterButton href="/locations?type=other" active={activeType === "other"}>
              其他
            </FilterButton>
          </div>
        </CardContent>
      </Card>

      {editing || searchParams.new === "1" ? <LocationForm location={editing} /> : null}

      {filteredCards.length ? (
        <div className="grid gap-3">
          {filteredCards.map((card) => (
            <Card key={`${card.type}-${card.name}`}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{card.name}</p>
                  <Badge className="mt-2 border-slate-200 bg-slate-50 text-slate-600">
                    {typeLabels[card.type]}
                  </Badge>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    当前库存：{card.stock.toFixed(2)}
                  </p>
                  {card.items.length ? (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                      {card.items.slice(0, 3).map((item) => (
                        <span
                          key={`${card.name}-${item.materialName}`}
                          className="rounded-full bg-slate-100 px-2 py-1"
                        >
                          {item.materialName} {item.stock.toFixed(2)}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">暂无库存明细</p>
                  )}
                </div>
                {card.location ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/locations?edit=${card.location.id}#location-form`}>
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Link>
                    </Button>
                    <form action={deleteLocationAction}>
                      <input type="hidden" name="id" value={card.location.id} />
                      <SubmitButton variant="danger" size="sm">
                        <Trash2 className="h-4 w-4" />
                        删除
                      </SubmitButton>
                    </form>
                  </div>
                ) : (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">未建档</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={MapPin} title="暂无地点" description="系统会自动创建自己仓。" />
      )}
    </div>
  );
}

function FilterButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Button asChild variant={active ? "default" : "secondary"} size="sm">
      <Link href={href}>{children}</Link>
    </Button>
  );
}

function LocationForm({
  location,
}: {
  location: Awaited<ReturnType<typeof listLocations>>[number] | null;
}) {
  return (
    <Card id="location-form">
      <CardHeader>
        <CardTitle>{location ? "编辑地点" : "新增地点"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={saveLocationAction} className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
          <input type="hidden" name="id" value={location?.id ?? ""} />
          <Field label="地点名称">
            <Input name="name" defaultValue={location?.name} required />
          </Field>
          <Field label="类型">
            <Select name="type" defaultValue={location?.type ?? "other"}>
              <option value="warehouse">仓库</option>
              <option value="factory">物料制作商</option>
              <option value="other">其他</option>
            </Select>
          </Field>
          <SubmitButton>{location ? "保存" : "新增"}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
