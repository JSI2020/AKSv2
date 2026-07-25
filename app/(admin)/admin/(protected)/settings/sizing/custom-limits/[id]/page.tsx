import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getCustomSizeLimit } from "@/modules/measure";
import { CustomSizeLimitForm } from "@/modules/sizing/custom-size-limit-ui";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function CustomSizeLimitEditPage({ params }: Props) {
  const { id } = await params;

  let limit;
  try {
    limit = await getCustomSizeLimit(id);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!limit) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Custom limits</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">Edit limit</h1>
      </div>
      <CustomSizeLimitForm
        limit={limit}
        categories={[]}
        measurementKeys={[]}
        mode="edit"
      />
    </div>
  );
}
