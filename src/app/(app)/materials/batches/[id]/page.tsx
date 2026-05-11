import { BatchDetail } from "@/components/batch-detail";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <BatchDetail
      id={id}
      error={query.error}
      deletedMovement={query.deletedMovement}
      editMovementId={query.editMovement}
    />
  );
}
