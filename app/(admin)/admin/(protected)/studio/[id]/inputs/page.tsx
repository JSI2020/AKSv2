import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { DesignInputsPanel } from "@/modules/ai/studio/design-inputs-panel";
import { getDesignInputsPageData } from "@/modules/ai/studio/input-actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function StudioDesignInputsPage({ params }: Props) {
  const { id } = await params;
  let data;
  try {
    data = await getDesignInputsPageData(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Studio · Inputs</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">{data.designName}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Upload sketches, fabric swatches, and references. Each file gets a role
          and weight — the pipeline builds lineart from sketches automatically.
        </p>
      </div>
      <DesignInputsPanel data={data} />
    </div>
  );
}
