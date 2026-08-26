import Link from "next/link";
import { ArrowLeft, Mail, MailCheck, MailX } from "lucide-react";

import { AdminPageHeader, StatTile, StatusBadge } from "@/modules/admin/ui";

import type { NewsletterSubscribersData } from "./newsletter-queries";

const dateFmt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function NewsletterSubscribersView({
  data,
}: {
  data: NewsletterSubscribersData;
}) {
  const { rows, activeCount, totalCount } = data;
  const unsubscribed = totalCount - activeCount;

  return (
    <div className="flex flex-col">
      <AdminPageHeader
        eyebrow="Customers · Newsletter"
        title="Subscribers"
        description="Everyone who signed up through the storefront footer. Idempotent by email — re-subscribing never duplicates a row."
        action={
          <Link
            href="/admin/customers"
            className="inline-flex items-center gap-1.5 border border-ink/15 px-3 py-1.5 text-[12px] text-ink/60 hover:border-ink hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Directory
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Active"
          value={activeCount}
          icon={<MailCheck className="size-4" />}
          hint="opted in"
          tone="zari"
        />
        <StatTile
          label="Total captured"
          value={totalCount}
          icon={<Mail className="size-4" />}
          hint="all time"
        />
        <StatTile
          label="Unsubscribed"
          value={unsubscribed}
          icon={<MailX className="size-4" />}
          hint="opted out"
          tone={unsubscribed > 0 ? "madder" : "ink"}
        />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border border-ink/12 bg-milk px-6 py-14 text-center">
          <Mail className="size-6 text-ink/35" />
          <p className="font-display text-[1.3rem] font-light text-ink">
            No subscribers yet
          </p>
          <p className="max-w-sm text-[13px] text-ink/55">
            Sign-ups from the storefront footer will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto border border-ink/12 bg-milk">
          <table className="w-full min-w-[560px] border-collapse text-start text-[12.5px]">
            <thead>
              <tr className="border-b border-ink/12 text-[10px] uppercase tracking-[0.1em] text-ink/50">
                <th className="px-4 py-3 text-start font-medium">Email</th>
                <th className="px-4 py-3 text-start font-medium">Source</th>
                <th className="px-4 py-3 text-start font-medium">Locale</th>
                <th className="px-4 py-3 text-start font-medium">Subscribed</th>
                <th className="px-4 py-3 text-start font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink/8 last:border-0">
                  <td className="px-4 py-2.5">
                    <a
                      href={`mailto:${r.email}`}
                      className="text-ink underline decoration-ink/20 underline-offset-2 hover:decoration-ink"
                    >
                      {r.email}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-ink/60">{r.source}</td>
                  <td className="px-4 py-2.5 font-data text-ink/60 uppercase">
                    {r.locale ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 font-data text-ink/60">
                    {dateFmt.format(r.subscribedAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {r.unsubscribedAt ? (
                      <StatusBadge tone="error">Unsubscribed</StatusBadge>
                    ) : (
                      <StatusBadge tone="success">Active</StatusBadge>
                    )}
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
