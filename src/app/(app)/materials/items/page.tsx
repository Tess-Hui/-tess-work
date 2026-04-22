import { MaterialManager } from "@/components/material-manager";

export const dynamic = "force-dynamic";

export default async function MaterialItemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MaterialManager searchParams={await searchParams} />;
}
