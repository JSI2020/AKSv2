import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  getGarmentCategory,
  listMeasurementKeys,
} from "@/modules/sizing";
import { CategoryForm } from "@/modules/sizing/category-form";

export default async function EditSizingCategoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let category;
  let keys;
  try {
    [category, keys] = await Promise.all([
      getGarmentCategory(id),
      listMeasurementKeys(),
    ]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!category) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Categories</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {category.name}
        </h1>
        <p className="mt-1 font-data text-[12px] text-chalk">{category.key}</p>
      </div>
      <CategoryForm category={category} allKeys={keys} mode="edit" />
    </div>
  );
}
