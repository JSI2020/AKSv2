import Link from "next/link";
import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import { DesignBriefWizard } from "@/modules/ai/studio/design-brief-wizard";
import { getDesignBriefFormData } from "@/modules/ai/studio/brief-actions";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";

type Props = {
  searchParams: Promise<{ collection?: string }>;
};

/** AI photoreal brief — kept off the primary Studio create path. */
export default async function StudioAiBriefPage({ searchParams }: Props) {
  const params = await searchParams;
  let data;
  try {
    data = await getDesignBriefFormData(params.collection ?? null);
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
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow className="text-ink/55">Studio · AI brief</Eyebrow>
        <h1 className="mt-1 font-display text-3xl font-light text-ink">
          New design brief
        </h1>
        <p className="mt-1 max-w-2xl text-[13.5px] text-ink/55">
          Photoreal path — fabric and colour feed generation. For manual
          catalogue entry with your own photos, use{" "}
          <Link href="/admin/studio/new" className="text-zari hover:underline">
            New design
          </Link>
          .
          {data.collection ? ` Collection: ${data.collection.label}.` : ""}
        </p>
      </div>
      <DesignBriefWizard data={data} />
    </div>
  );
}
