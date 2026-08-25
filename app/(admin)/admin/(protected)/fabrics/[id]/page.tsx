import { notFound, redirect } from "next/navigation";

import { PermissionDeniedError, UnauthenticatedError } from "@/modules/auth";
import { FabricEditor } from "@/modules/fabrics/admin/fabric-editor";
import { getFabric } from "@/modules/sizing/fabric-admin-actions";
import { getFabricStockDetail } from "@/modules/inventory";
import { getFabricRelated } from "@/modules/insights/queries-related";

export default async function EditFabricPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let fabric;
  let stock;
  let related = null;
  try {
    [fabric, stock, related] = await Promise.all([
      getFabric(id),
      getFabricStockDetail(id),
      getFabricRelated(id),
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
  if (!fabric || !stock) notFound();

  return (
    <FabricEditor
      mode="edit"
      fabric={fabric}
      stock={stock}
      designs={related?.designs ?? []}
    />
  );
}
