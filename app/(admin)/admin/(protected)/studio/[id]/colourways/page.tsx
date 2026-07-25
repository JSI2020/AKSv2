import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { ColourwaysPanel } from "@/modules/ai/studio/colourways-panel";
import { getColourwaysPageData } from "@/modules/ai/studio/colourway-actions";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio colourway recolour — grid review, approve per set. */
export default async function StudioColourwaysPage({ params }: Props) {
  const { id } = await params;

  let data;
  try {
    data = await getColourwaysPageData(id);
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
        <Eyebrow>Studio · Colourways</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {data.designName}
        </h1>
        <p className="mt-1 max-w-2xl text-[13px] text-chalk">
          Recolour locked angles for additional colourways. One base colourway is
          enough to publish — extra colours are optional.
        </p>
      </div>
      <ColourwaysPanel data={data} />
    </div>
  );
}
