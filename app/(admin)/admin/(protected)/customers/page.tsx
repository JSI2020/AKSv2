import { redirect } from "next/navigation";

import { auth } from "@/auth";
import {
  PermissionDeniedError,
  UnauthenticatedError,
  userHasPermission,
} from "@/modules/auth";
import { CustomersDirectoryView } from "@/modules/customers/customers-directory-view";
import { listCustomerDirectory } from "@/modules/customers/queries";
import {
  CRM_SOURCES,
  type CrmSourceFilter,
} from "@/modules/customers/source";

function parseSource(raw: string | undefined): CrmSourceFilter {
  if (!raw) return "ALL";
  if (raw === "ALL" || raw === "DUPLICATES") return raw;
  const upper = raw.toUpperCase();
  if ((CRM_SOURCES as readonly string[]).includes(upper)) {
    return upper as CrmSourceFilter;
  }
  return "ALL";
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; source?: string }>;
}) {
  const params = await searchParams;
  const query = params.q ?? "";
  const source = parseSource(params.source);

  let directory;
  try {
    directory = await listCustomerDirectory({ query, source });
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  const session = await auth();
  const canEdit = session?.user?.id
    ? await userHasPermission(session.user.id, "customers.edit")
    : false;

  return (
    <CustomersDirectoryView
      rows={directory.rows}
      duplicatePairCount={directory.duplicatePairCount}
      initialQuery={query}
      initialSource={source}
      canEdit={canEdit}
    />
  );
}
