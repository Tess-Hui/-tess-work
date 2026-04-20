import { TaskManager } from "@/components/task-manager";

export const dynamic = "force-dynamic";

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <TaskManager status="todo" searchParams={await searchParams} />;
}
