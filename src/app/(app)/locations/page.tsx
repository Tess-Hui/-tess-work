import { LocationManager } from "@/components/location-manager";

export const dynamic = "force-dynamic";

export default async function LocationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <LocationManager searchParams={await searchParams} />;
}
