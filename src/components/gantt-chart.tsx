import type { Task } from "@/db/schema";
import { formatDateTime } from "@/lib/dates";
import { priorityClassNames } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DAY_WIDTH = 64;

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function diffDays(left: Date, right: Date) {
  const ms = startOfDay(left).getTime() - startOfDay(right).getTime();
  return Math.round(ms / 86_400_000);
}

function priorityBarClass(priority: Task["priority"]) {
  if (priority === "high") return "bg-red-500";
  if (priority === "medium") return "bg-amber-500";
  return "bg-emerald-500";
}

export function GanttChart({ tasks, compact = false }: { tasks: Task[]; compact?: boolean }) {
  if (!tasks.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
        暂无可展示任务。添加任务后会自动生成甘特图。
      </div>
    );
  }

  const rows = tasks.map((task) => {
    const start = task.createdAt;
    const end = task.plannedAt ?? task.createdAt;
    return { task, start, end };
  });
  const minDate = rows.reduce((min, row) => (row.start < min ? row.start : min), rows[0].start);
  const maxDate = rows.reduce((max, row) => (row.end > max ? row.end : max), rows[0].end);
  const totalDays = Math.max(diffDays(maxDate, minDate) + 1, 1);
  const days = Array.from({ length: totalDays }, (_, index) => {
    const date = new Date(startOfDay(minDate));
    date.setDate(date.getDate() + index);
    return date;
  });
  const visibleRows = compact ? rows.slice(0, 5) : rows;

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div style={{ minWidth: `${Math.max(720, totalDays * DAY_WIDTH + 280)}px` }}>
        <div className="grid grid-cols-[16rem_1fr] border-b border-slate-200 text-xs font-medium text-slate-500">
          <div className="px-3 py-2">任务</div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${totalDays}, ${DAY_WIDTH}px)` }}>
            {days.map((day) => (
              <div key={day.toISOString()} className="border-l border-slate-200 px-2 py-2">
                {day.getMonth() + 1}/{day.getDate()}
              </div>
            ))}
          </div>
        </div>
        <div className="grid">
          {visibleRows.map(({ task, start, end }) => {
            const left = Math.max(diffDays(start, minDate), 0) * DAY_WIDTH;
            const width = Math.max(diffDays(end, start) + 1, 1) * DAY_WIDTH;
            return (
              <div key={task.id} className="grid min-h-20 grid-cols-[16rem_1fr] border-b border-slate-100">
                <div className="min-w-0 px-3 py-3">
                  <p className="truncate text-sm font-medium text-slate-950">{task.content}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <Badge className={priorityClassNames[task.priority]}>{task.priority}</Badge>
                    <Badge className={task.status === "completed" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>
                      {task.status === "completed" ? "done" : "todo"}
                    </Badge>
                  </div>
                </div>
                <div className="gantt-grid relative">
                  <div
                    className={`absolute top-5 h-8 rounded-md ${priorityBarClass(task.priority)} ${
                      task.status === "completed" ? "opacity-55" : "opacity-95"
                    }`}
                    style={{ left, width }}
                    title={`${formatDateTime(start)} - ${formatDateTime(end)}`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function GanttPreviewCard({ tasks }: { tasks: Task[] }) {
  return (
    <Card>
      <CardContent className="p-4">
        <GanttChart tasks={tasks} compact />
      </CardContent>
    </Card>
  );
}
