import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getDesignFormOptions } from "@/modules/designs";
import { CreateDesignForm } from "@/modules/designs/design-editor";

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
        <Eyebrow>Designs</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">New design</h1>
      </div>
      <CreateDesignForm options={options} />
    </div>
  );
}
