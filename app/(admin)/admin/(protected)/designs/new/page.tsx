import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getDesignFormOptions } from "@/modules/designs";
import { CreateDesignForm } from "@/modules/designs/design-editor";

/** Same pipeline as editing an existing design — creates DRAFT then opens editor. */
export default async function NewDesignPage() {
  let options;
  try {
    options = await getDesignFormOptions();
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
        <Eyebrow className="text-ink/55">Create · Designs</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-light text-ink">
          New design
        </h1>
        <p className="mt-1 max-w-xl text-[13.5px] text-ink/55">
          Starts as a draft — then Details, Photos, Sizing, Costing, Price, and
          Preview, same as every other design.
        </p>
      </div>
      <CreateDesignForm options={options} />
    </div>
  );
}
