import { notFound, redirect } from "next/navigation";

import { getDesignInputsPageData } from "@/modules/ai/studio/input-actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

type Props = {
  params: Promise<{ id: string }>;
};

/** Studio design hub — hero loop lands here in Step 39; inputs for now. */
export default async function StudioDesignPage({ params }: Props) {
  const { id } = await params;
  try {
    const data = await getDesignInputsPageData(id);
    if (!data) notFound();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  redirect(`/admin/studio/${id}/inputs`);
}
