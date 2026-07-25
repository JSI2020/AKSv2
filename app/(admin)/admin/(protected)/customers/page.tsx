import { redirect } from "next/navigation";

import { EmptyState, Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { CustomersTable, listCustomers } from "@/modules/insights";

export default async function AdminCustomersPage() {
  let customers;
  try {
    customers = await listCustomers();
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
      <Eyebrow>Customers</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Customers</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Profiles, measurements, order history, and related panels.
      </p>
      <div className="mt-6">
        {customers.length === 0 ? (
          <EmptyState
            title="No customers yet"
            description="Customer profiles appear after the first web or manual order."
          />
        ) : (
          <CustomersTable customers={customers} />
        )}
      </div>
    </div>
  );
}
