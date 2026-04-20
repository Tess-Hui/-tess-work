import { GanttChart } from "@/components/gantt-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listGanttTasks } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function GanttPage() {
  const tasks = await listGanttTasks();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">甘特图</h1>
        <p className="mt-1 text-sm text-slate-500">根据任务创建时间和计划完成时间生成，手机端可横向滚动查看。</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>任务排期 Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <GanttChart tasks={tasks} />
        </CardContent>
      </Card>
    </div>
  );
}
