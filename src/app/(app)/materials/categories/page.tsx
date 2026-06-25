import { MaterialCategoryManager } from "@/components/material-category-manager";

export const dynamic = "force-dynamic";

export default async function MaterialCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  return <MaterialCategoryManager searchParams={await searchParams} />;
}
