import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
  requirePermission,
} from "@/modules/auth";
import { GarmentSizingTool } from "@/modules/dress-sizing/ui/garment-sizing-tool";

/**
 * Garment sizing — standalone. Measures any uploaded photo without binding the
 * result to a design, so the engine can be tried and judged on its own.
 */
export default async function StudioGarmentSizingPage() {
  try {
    await requirePermission("designs.create");
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
        <Eyebrow>Studio · Garment sizing</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          Measure a garment from a photo
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Upload a garment photo to get its XS–XXL size chart and a ghost
          mannequin. Nothing is saved to a design — use this to check the
          engine, then build the real chart from a design&apos;s Sizing tab.
        </p>
      </div>
      <GarmentSizingTool />
    </div>
  );
}
