import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getFabric } from "@/modules/sizing/fabric-archetype-actions";
import { FabricForm } from "@/modules/sizing/fabric-archetype-ui";

export default async function EditFabricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let fabric;
  try {
    fabric = await getFabric(id);
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
    </div>
  );
}
