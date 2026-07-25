import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getSizeBlock } from "@/modules/sizing/block-actions";
import { SizeChartEditor } from "@/modules/sizing/size-chart-editor";

export default async function SizeBlockEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let block;
  try {
    block = await getSizeBlock(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!block) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Blocks</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">{block.name}</h1>
        <p className="mt-1 font-data text-[12px] text-chalk">
          {block.categoryKey} · {block.categoryName}
        </p>
      </div>
      <SizeChartEditor block={block} />
    </div>
  );
}
