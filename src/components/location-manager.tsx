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
import { listLocations } from "@/lib/data";

type Params = { edit?: string; new?: string; error?: string };

const typeLabels = {
  warehouse: "仓库",
  factory: "物料制作商",
  other: "其他",
} as const;

export async function LocationManager({ searchParams }: { searchParams: Params }) {
  const items = await listLocations();
  const editing = items.find((item) => item.id === searchParams.edit) ?? null;

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

      {editing || searchParams.new === "1" ? <LocationForm location={editing} /> : null}

      {items.length ? (
        <div className="grid gap-3">
          {items.map((location) => (
            <Card key={location.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">{location.name}</p>
                  <Badge className="mt-2 border-slate-200 bg-slate-50 text-slate-600">
                    {typeLabels[location.type]}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/locations?edit=${location.id}#location-form`}>
                      <Pencil className="h-4 w-4" />
                      编辑
                    </Link>
                  </Button>
                  <form action={deleteLocationAction}>
                    <input type="hidden" name="id" value={location.id} />
                    <SubmitButton variant="danger" size="sm">
                      <Trash2 className="h-4 w-4" />
                      删除
                    </SubmitButton>
                  </form>
                </div>
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
