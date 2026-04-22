import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { listBatches } from "@/lib/data";

export async function ExportManager() {
  const batches = await listBatches();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">导出</h1>
        <p className="mt-1 text-sm text-slate-500">导出物料流转、单批次明细和当前库存 Excel。</p>
      </div>

      <section className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>时间段流转表</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/api/materials/export/movements" method="get" className="grid gap-4">
              <Field label="开始日期">
                <Input name="start" type="date" />
              </Field>
              <Field label="结束日期">
                <Input name="end" type="date" />
              </Field>
              <Button>
                <Download className="h-4 w-4" />
                导出流转
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>单批次明细</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/api/materials/export/batch" method="get" className="grid gap-4">
              <Field label="批次">
                <Select name="batchId" required>
                  <option value="">选择批次</option>
                  {batches.map((row) => (
                    <option key={row.batch.id} value={row.batch.id}>
                      {row.batch.batchCode} - {row.material.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button>
                <Download className="h-4 w-4" />
                导出批次
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>当前库存表</CardTitle>
          </CardHeader>
          <CardContent>
            <form action="/api/materials/export/inventory" method="get" className="grid gap-4">
              <p className="text-sm text-slate-500">导出所有物料、批次和地点的当前库存。</p>
              <Button>
                <Download className="h-4 w-4" />
                导出库存
              </Button>
            </form>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
