import { FixedManager } from "@/components/fixed-manager";

export const dynamic = "force-dynamic";

export default async function FixedPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <FixedManager searchParams={await searchParams} />;
}
