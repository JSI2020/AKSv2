import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getSizingPageData } from "@/modules/ai/studio/sizing-actions";
import { SizingPanel } from "@/modules/ai/studio/sizing-panel";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio sizing overlay — opt-in deviations from the category standard chart. */
export default async function StudioSizingPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getSizingPageData(id);
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
        <Eyebrow>Studio · Sizing</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {data.designName}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Deviate from the standard chart only when needed. Chalk preview is
          free — one regeneration when you apply.
        </p>
      </div>
      <SizingPanel data={data} />
    </div>
  );
}
