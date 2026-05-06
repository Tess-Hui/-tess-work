import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { getBatchDetail, numberValue } from "@/lib/data";
import { createXlsx } from "@/lib/xlsx";

const movementLabels = {
  OUT: "发货",
  TRANSFER: "调拨",
  RETURN: "退回",
  SCRAP: "报废",
  CONSUME: "扣减",
} as const;

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const batchId = request.nextUrl.searchParams.get("batchId");
  const detail = await getBatchDetail(batchId);
  if (!detail) return new Response("Batch not found", { status: 404 });

  const workbook = createXlsx([
    {
      name: "批次信息",
      rows: [
        ["批次编号", detail.batch.batchCode],
        ["物料", detail.material.name],
        ["物料尺寸", detail.material.size],
        ["制作日期", String(detail.batch.productionDate)],
        ["制作数量", numberValue(detail.batch.quantity)],
        ["单价", numberValue(detail.batch.price)],
        ["总价", numberValue(detail.batch.totalPrice)],
        ["仓库", detail.batch.supplier],
        ["物料制作商", detail.batch.manufacturer],
        ["状态", detail.batch.status],
        ["备注", detail.batch.remark],
      ],
    },
    {
      name: "库存分布",
      rows: [
        ["地点", "数量"],
        ...detail.stockDistribution.map((item) => [item.location.name, item.quantity]),
      ],
    },
    {
      name: "流转记录",
      rows: [
        ["日期", "类型", "从地点", "到地点", "数量", "备注"],
        ...detail.movements.map((movement) => {
          const from = detail.locations.find((location) => location.id === movement.fromLocationId);
          const to = detail.locations.find((location) => location.id === movement.toLocationId);
          return [
            String(movement.date),
            movementLabels[movement.type],
            from?.name ?? "",
            to?.name ?? "",
            numberValue(movement.quantity),
            movement.remark,
          ];
        }),
      ],
    },
  ]);

  return new Response(new Uint8Array(workbook), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${detail.batch.batchCode}.xlsx"`,
    },
  });
}
