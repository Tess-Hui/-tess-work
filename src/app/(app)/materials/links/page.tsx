import { InventoryLinkManager } from "@/components/inventory-link-manager";

export const dynamic = "force-dynamic";

export default async function InventoryLinksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <InventoryLinkManager searchParams={await searchParams} />;
}
