import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { listMovementsForExport, numberValue } from "@/lib/data";
import { createXlsx } from "@/lib/xlsx";

const movementLabels = {
  OUT: "发货",
  TRANSFER: "调货",
  RETURN: "退回",
  SCRAP: "报废",
  CONSUME: "扣减",
  STOCK_IN: "增加库存",
} as const;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = request.nextUrl;
  const rows = await listMovementsForExport({
    startDate: searchParams.get("start") ?? undefined,
    endDate: searchParams.get("end") ?? undefined,
  });

  const workbook = createXlsx([
    {
      name: "时间段流转表",
      rows: [
        ["日期", "批次编号", "物料", "类型", "从地点", "到地点", "数量", "备注"],
        ...rows.map((row) => [
          String(row.movement.date),
          row.batch.batchCode,
          row.material.name,
          movementLabels[row.movement.type],
          row.movement.type === "STOCK_IN" ? "新增库存" : row.fromLocation?.name ?? "",
          row.toLocation?.name ?? "",
          numberValue(row.movement.quantity),
          row.movement.remark,
        ]),
      ],
    },
  ]);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="movements.xlsx"',
    },
  });
}
