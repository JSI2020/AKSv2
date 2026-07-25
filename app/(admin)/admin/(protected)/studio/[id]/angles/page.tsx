import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { AnglesPanel } from "@/modules/ai/studio/angles-panel";
import { getAnglesPageData } from "@/modules/ai/studio/angle-actions";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio angle review — three-quarter and back from locked hero. */
export default async function StudioAnglesPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getAnglesPageData(id);
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
        <Eyebrow>Studio · Angles</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {data.designName}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Three angles side by side — hero is the master reference. Approve each
          derived angle, then lock. Regenerations always re-derive from the locked
          hero, never from another angle.
        </p>
      </div>
      <AnglesPanel data={data} />
    </div>
  );
}
