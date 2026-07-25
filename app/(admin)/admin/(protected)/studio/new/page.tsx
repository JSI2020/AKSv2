import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { DesignBriefWizard } from "@/modules/ai/studio/design-brief-wizard";
import { getDesignBriefFormData } from "@/modules/ai/studio/brief-actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

export default async function NewStudioBriefPage({ searchParams }: Props) {
  const params = await searchParams;
  let data;
  try {
    data = await getDesignBriefFormData(params.collection ?? null);
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
        <Eyebrow>Studio · Brief</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">New design brief</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Pick fabric and colour — everything else inherits from studio defaults
          {data.collection ? ` and ${data.collection.label}` : ""}. Save a
          complete brief in under 30 seconds.
        </p>
      </div>
      <DesignBriefWizard data={data} />
    </div>
  );
}
