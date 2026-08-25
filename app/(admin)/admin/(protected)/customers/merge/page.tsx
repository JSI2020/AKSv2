import { notFound, redirect } from "next/navigation";

import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { MergeCustomersView } from "@/modules/customers/merge-customers-view";
import {
  listMergeCandidates,
  resolveMergeCard,
} from "@/modules/customers/queries";

export default async function MergeCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const params = await searchParams;
  const a = params.a?.trim();
  const b = params.b?.trim();

  if (!a) {
    redirect("/admin/customers");
  }

  let cardA;
  let cardB = null;
  let candidates;
  try {
    cardA = await resolveMergeCard(a);
    if (!cardA) notFound();
    cardB = b ? await resolveMergeCard(b) : null;
    candidates = await listMergeCandidates(a);
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
    <MergeCustomersView
      cardA={cardA}
      cardB={cardB}
      candidates={candidates}
    />
  );
}
