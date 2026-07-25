import { redirect } from "next/navigation";

import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { getMoneyDashboardData, MoneyDashboard } from "@/modules/money";

export default async function AdminMoneyPage() {
  let data;
  try {
    data = await getMoneyDashboardData();
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
      <Eyebrow>Money</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Money</h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Costs, revenue, margin, and break-even — am I profitable?
      </p>
      <div className="mt-6">
        <MoneyDashboard data={data} />
      </div>
    </div>
  );
}
