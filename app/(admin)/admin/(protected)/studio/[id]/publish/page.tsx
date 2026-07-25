import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { PublishPanel } from "@/modules/ai/studio/publish-panel";
import { getPublishPageData } from "@/modules/ai/studio/publish-actions";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio publish gate — blocking checklist before PUBLISHED. */
export default async function StudioPublishPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getPublishPageData(id);
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
        <Eyebrow>Studio · Publish</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {data.designName}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Complete the checklist, then publish. The design appears on the storefront
          with instant colour switching from cached renders.
        </p>
      </div>
      <PublishPanel data={data} />
    </div>
  );
}
