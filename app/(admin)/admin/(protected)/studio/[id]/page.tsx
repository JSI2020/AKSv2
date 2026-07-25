import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { HeroLoopPanel } from "@/modules/ai/studio/hero-loop-panel";
import { getHeroLoopPageData } from "@/modules/ai/studio/hero-actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio hero generation loop — front angle, base colourway, base size. */
export default async function StudioDesignPage({ params }: Props) {
  const { id } = await params;
  let data;
  try {
    data = await getHeroLoopPageData(id);
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
        <Eyebrow>Studio · Hero</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">{data.designName}</h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Front angle, base colourway, base size on the selected archetype.
          Iterate until you approve — then the hero locks for downstream stages.
        </p>
      </div>
      <HeroLoopPanel data={data} />
    </div>
  );
}
