import { MaterialSizeManager } from "@/components/material-size-manager";

export const dynamic = "force-dynamic";

export default async function MaterialSizesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MaterialSizeManager searchParams={await searchParams} />;
}
