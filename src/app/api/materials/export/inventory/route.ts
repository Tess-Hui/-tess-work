import { getSession } from "@/lib/auth";
import { getInventoryExportRows } from "@/lib/data";
import { createXlsx } from "@/lib/xlsx";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const rows = await getInventoryExportRows();
  const workbook = createXlsx([
    {
      name: "当前库存表",
      rows: [
        ["物料", "类型", "物料尺寸", "单位", "批次编号", "地点", "当前库存"],
        ...rows.map((row) => [
          row.material.name,
          row.material.type,
          row.material.size,
          row.material.unit,
          row.batch.batchCode,
          row.location.name,
          row.quantity,
        ]),
      ],
    },
  ]);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="inventory.xlsx"',
    },
  });
}
