import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import {
  CustomerRelatedPanels,
  getCustomerRelated,
} from "@/modules/insights";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;

  let data;
  try {
    data = await getCustomerRelated(userId);
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  if (!data) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/customers"
          className="font-sans text-[12px] text-chalk hover:text-zari"
        >
          ← All customers
        </Link>
        <Eyebrow>Customers</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          {data.name ?? data.email ?? "Customer"}
        </h1>
        {data.email ? (
          <p className="mt-1 font-data text-[12px] text-chalk">{data.email}</p>
        ) : null}
      </div>
      <CustomerRelatedPanels data={data} />
    </div>
  );
}
