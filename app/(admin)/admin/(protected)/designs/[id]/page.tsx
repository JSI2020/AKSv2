import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getDesign, getDesignFormOptions } from "@/modules/designs";
import { DesignEditor } from "@/modules/designs/design-editor";

export default async function DesignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let detail;
  let options;
  try {
    [detail, options] = await Promise.all([
      getDesign(id),
      getDesignFormOptions(),
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

  if (!detail) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Designs</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {detail.design.name}
        </h1>
        <p className="mt-1 font-data text-[12px] text-chalk">
          {detail.categoryKey}
        </p>
      </div>
      <DesignEditor detail={detail} options={options} />
    </div>
  );
}
