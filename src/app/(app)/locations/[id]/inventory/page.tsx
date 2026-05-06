import { LocationInventoryDetail } from "@/components/location-inventory-detail";

export const dynamic = "force-dynamic";

export default async function LocationInventoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LocationInventoryDetail id={id} />;
}
