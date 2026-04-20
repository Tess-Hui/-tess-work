import { MemoManager } from "@/components/memo-manager";

export const dynamic = "force-dynamic";

export default async function MemosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MemoManager searchParams={await searchParams} />;
}
