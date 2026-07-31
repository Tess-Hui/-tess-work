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
import { InventoryItemBars, formatInventoryNumber } from "@/components/inventory-item-bars";
import { deleteLocationAction, saveLocationAction } from "@/lib/actions";
import { getLocationStockSummary, listLocations } from "@/lib/data";

type Params = { edit?: string; new?: string; error?: string; type?: string };

const typeLabels = {
  warehouse: "仓库",
  other: "其他",
} as const;

export async function LocationManager({ searchParams }: { searchParams: Params }) {
  const [items, stockSummary] = await Promise.all([listLocations(), getLocationStockSummary()]);
  const editing = items.find((item) => item.id === searchParams.edit) ?? null;
  const activeType = searchParams.type === "warehouse" || searchParams.type === "other"
    ? searchParams.type
    : "all";
  const stockByLocationId = new Map(stockSummary.map((summary) => [summary.locationId, summary]));
  const filteredCards = items
    .filter((location) => (activeType === "all"
      ? true
      : activeType === "warehouse"
        ? location.type === "warehouse"
        : location.type !== "warehouse"))
    .map((location) => ({
      name: location.name,
      type: (location.type === "warehouse" ? "warehouse" : "other") as "warehouse" | "other",
      stock: stockByLocationId.get(location.id)?.totalStock ?? 0,
      items: stockByLocationId.get(location.id)?.items ?? [],
      location,
    }))
    .sort((a, b) => {
      if (a.type !== b.type) {
        return a.type.localeCompare(b.type, "en");
      }
      return b.stock - a.stock || a.name.localeCompare(b.name, "zh-Hans-CN");
    });

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">各仓库库存分布</h1>
          <p className="mt-1 text-sm text-slate-500">查看各仓库当前库存，并管理仓库名称。</p>
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
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              <FilterButton href="/locations" active={activeType === "all"}>
                全部
              </FilterButton>
              <FilterButton href="/locations?type=warehouse" active={activeType === "warehouse"}>
                仓库
              </FilterButton>
              <FilterButton href="/locations?type=other" active={activeType === "other"}>
                其他
              </FilterButton>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href="/locations?new=1#location-form">新增地点</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {editing || searchParams.new === "1" ? <LocationForm location={editing} /> : null}

      {filteredCards.length ? (
        <div className="grid gap-3">
          {filteredCards.map((card) => {
            const detailHref = `/locations/${card.location.id}/inventory`;

            return (
            <Card key={`${card.type}-${card.name}`}>
              <CardContent className="grid gap-4 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{card.name}</p>
                    <Badge className="mt-2 border-slate-200 bg-slate-50 text-slate-600">
                      {typeLabels[card.type]}
                    </Badge>
                    <p className="mt-2 text-sm font-medium text-slate-900">
                      当前库存：{formatInventoryNumber(card.stock)}
                    </p>
                  </div>
                {card.location ? (
                  <div className="flex flex-wrap gap-2">
                    {card.location.type === "warehouse" ? (
                      <Button asChild variant="secondary" size="sm">
                        <Link href={detailHref}>
                          库存详情
                        </Link>
                      </Button>
                    ) : null}
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
                </div>
                <InventoryItemBars items={card.items} limit={5} detailHref={detailHref} />
              </CardContent>
            </Card>
          );
        })}
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
      <Link
        href={href}
        className={active ? "!text-white hover:!text-white focus:!text-white" : "text-slate-900"}
      >
        {children}
      </Link>
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
            <Select
              name="type"
              defaultValue={location?.type === "warehouse" ? "warehouse" : "other"}
            >
              <option value="warehouse">仓库</option>
              <option value="other">其他</option>
            </Select>
          </Field>
          <SubmitButton>{location ? "保存" : "新增"}</SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
