import { BatchManager } from "@/components/batch-manager";

export const dynamic = "force-dynamic";

export default async function MaterialBatchesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <BatchManager searchParams={await searchParams} />;
}
