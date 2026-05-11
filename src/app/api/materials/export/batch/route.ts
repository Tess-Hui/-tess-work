import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { getBatchDetail, numberValue } from "@/lib/data";
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

  const batchId = request.nextUrl.searchParams.get("batchId");
  const detail = await getBatchDetail(batchId);
  if (!detail) return new Response("Batch not found", { status: 404 });
  const quantity = numberValue(detail.batch.quantity);
  const originalTotalPrice = numberValue(detail.batch.totalPrice);
  const stockInMovements = detail.movements.filter((movement) => movement.type === "STOCK_IN");
  const stockInQuantity = stockInMovements.reduce(
    (sum, movement) => sum + numberValue(movement.quantity),
    0,
  );
  const stockInTotalPrice = stockInMovements.reduce(
    (sum, movement) => sum + numberValue(movement.totalPrice),
    0,
  );
  const cumulativeQuantity = quantity + stockInQuantity;
  const cumulativeTotalPrice = originalTotalPrice + stockInTotalPrice;
  const averageUnitPrice = cumulativeQuantity > 0 ? cumulativeTotalPrice / cumulativeQuantity : 0;

  const workbook = createXlsx([
    {
      name: "批次信息",
      rows: [
        ["批次编号", detail.batch.batchCode],
        ["物料", detail.material.name],
        ["物料尺寸", detail.material.size],
        ["制作日期", String(detail.batch.productionDate)],
        ["制作数量", quantity],
        ["原始批次总价", originalTotalPrice],
        ["增加库存总价", stockInTotalPrice],
        ["累计总价", cumulativeTotalPrice],
        ["平均单价", averageUnitPrice],
        ["仓库", detail.batch.supplier],
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
        ["日期", "类型", "从地点", "到地点", "数量", "总价", "单价", "备注"],
        ...detail.movements.map((movement) => {
          const from = detail.locations.find((location) => location.id === movement.fromLocationId);
          const to = detail.locations.find((location) => location.id === movement.toLocationId);
          const fromName = movement.type === "STOCK_IN" ? "新增库存" : from?.name ?? "";
          const movementQuantity = numberValue(movement.quantity);
          const movementTotalPrice =
            movement.type === "STOCK_IN" ? numberValue(movement.totalPrice) : "";
          const movementUnitPrice =
            movement.type === "STOCK_IN" && movementQuantity > 0
              ? numberValue(movement.totalPrice) / movementQuantity
              : "";
          return [
            String(movement.date),
            movementLabels[movement.type],
            fromName,
            to?.name ?? "",
            movementQuantity,
            movementTotalPrice,
            movementUnitPrice,
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
