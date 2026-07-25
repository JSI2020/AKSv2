import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getFabric } from "@/modules/sizing/fabric-archetype-actions";
import { FabricForm } from "@/modules/sizing/fabric-archetype-ui";
import { FabricRelatedPanels, getFabricRelated } from "@/modules/insights";

export default async function EditFabricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let fabric;
  let related = null;
  try {
    [fabric, related] = await Promise.all([getFabric(id), getFabricRelated(id)]);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!fabric) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Fabric</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">{fabric.name}</h1>
      </div>
      <FabricForm fabric={fabric} />
      {related ? <FabricRelatedPanels data={related} /> : null}
    </div>
  );
}
