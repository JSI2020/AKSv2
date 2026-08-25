import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { GalleryClient } from "@/modules/photoreal/admin/gallery-client";
import { listPhotorealDesignsAction } from "@/modules/photoreal/actions";

export default async function AdminPhotorealGalleryPage() {
  try {
    const result = await listPhotorealDesignsAction();
    if (!result.ok) {
      redirect("/admin");
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
      <Eyebrow>Photoreal · Gallery</Eyebrow>
      <GalleryClient />
    </div>
  );
}
