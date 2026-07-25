"use client";

import Link from "next/link";
import { useState } from "react";

import { Money } from "@/modules/ui";

import type { CustomerListItem } from "./queries-related";

type Props = {
  customers: CustomerListItem[];
};

export function CustomersTable({ customers }: Props) {
  const [filter, setFilter] = useState("");

  const q = filter.trim().toLowerCase();
  const filtered = q
    ? customers.filter(
        (c) =>
          (c.name ?? "").toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q),
      )
    : customers;

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter customers…"
        className="max-w-sm border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
      />

      {filtered.length === 0 ? (
        <p className="text-[13px] text-chalk">No customers match.</p>
      ) : (
        <div className="overflow-x-auto border border-indigo-lift">
          <table className="w-full min-w-[36rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-indigo-lift text-chalk">
                <th className="px-3 py-2 text-start font-normal">Name</th>
                <th className="px-3 py-2 text-start font-normal">Contact</th>
                <th className="px-3 py-2 text-end font-normal">Orders</th>
                <th className="px-3 py-2 text-end font-normal">LTV</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((customer) => (
                <tr
                  key={customer.userId}
                  className="border-b border-indigo-lift/50 text-greige"
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/admin/customers/${customer.userId}`}
                      className="text-zari hover:underline"
                    >
                      {customer.name ?? "—"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-chalk">
                    {customer.email ?? customer.phone ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-end font-data">
                    {customer.totalOrdersCount}
                  </td>
                  <td className="px-3 py-2 text-end">
                    <Money value={customer.lifetimeValueMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
