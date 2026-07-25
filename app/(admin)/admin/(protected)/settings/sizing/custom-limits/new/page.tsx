import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  listGarmentCategories,
  listMeasurementKeys,
} from "@/modules/sizing";
import { CustomSizeLimitForm } from "@/modules/sizing/custom-size-limit-ui";

export default async function CustomSizeLimitNewPage() {
  let categories;
  let keys;
  try {
    [categories, keys] = await Promise.all([
      listGarmentCategories(),
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Custom limits</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">New limit</h1>
      </div>
      <CustomSizeLimitForm
        limit={null}
        categories={categories.map((c) => ({
          id: c.id,
          key: c.key,
          name: c.name,
        }))}
        measurementKeys={keys.map((k) => ({ key: k.key, label: k.label }))}
        mode="create"
      />
    </div>
  );
}
