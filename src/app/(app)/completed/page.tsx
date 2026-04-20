import { TaskManager } from "@/components/task-manager";

export const dynamic = "force-dynamic";

export default async function CompletedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <TaskManager status="completed" searchParams={await searchParams} />;
}
