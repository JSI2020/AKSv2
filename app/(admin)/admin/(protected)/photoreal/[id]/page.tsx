import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { DesignDetailClient } from "@/modules/photoreal/admin/design-detail-client";
import { getPhotorealDesignAction } from "@/modules/photoreal/actions";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AdminPhotorealDesignPage({ params }: Props) {
  const { id } = await params;

  try {
    const result = await getPhotorealDesignAction(id);
    if (!result.ok) {
      redirect("/admin/photoreal/gallery");
    }
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div>
      <Eyebrow>Photoreal · Design</Eyebrow>
      <DesignDetailClient designId={id} />
    </div>
  );
}
