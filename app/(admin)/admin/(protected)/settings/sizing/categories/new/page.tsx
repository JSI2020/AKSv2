import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listMeasurementKeys } from "@/modules/sizing";
import { CategoryForm } from "@/modules/sizing/category-form";

export default async function NewSizingCategoryPage() {
  let keys;
  try {
    keys = await listMeasurementKeys();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Categories</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          New category
        </h1>
      </div>
      <CategoryForm category={null} allKeys={keys} mode="create" />
    </div>
  );
}
