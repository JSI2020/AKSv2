import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getStudioFormOptions } from "@/modules/designs/studio-manual-actions";
import { StudioManualForm } from "@/modules/designs/studio-manual-form";

/** Manual catalogue create — admin photos, no photoreal brief. */
export default async function NewStudioDesignPage() {
  let options;
  try {
    options = await getStudioFormOptions();
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
        <Eyebrow className="text-ink/55">Studio · New</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-light text-ink">
          New design
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink/55">
          Name, sizes, colours, photos, costing, and price. Upload your own
          imagery — this is not the AI generation path.
        </p>
      </div>
      <StudioManualForm options={options} />
    </div>
  );
}
