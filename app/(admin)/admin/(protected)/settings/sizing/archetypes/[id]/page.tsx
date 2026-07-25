import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getHouseModel } from "@/modules/sizing/fabric-archetype-actions";
import { HouseModelForm } from "@/modules/sizing/fabric-archetype-ui";

export default async function EditArchetypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let model;
  try {
    model = await getHouseModel(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }
  if (!model) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Archetypes</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">{model.name}</h1>
      </div>
      <HouseModelForm model={model} />
    </div>
  );
}
