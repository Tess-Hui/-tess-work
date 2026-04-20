import { ReminderManager } from "@/components/reminder-manager";

export const dynamic = "force-dynamic";

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <ReminderManager searchParams={await searchParams} />;
}
