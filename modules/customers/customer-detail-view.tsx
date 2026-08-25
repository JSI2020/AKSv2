"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { Money } from "@/modules/ui";

import type { CustomerDetail } from "./types";
import {
  formatWhatsAppHref,
  initialsFromName,
  maskPhone,
} from "./phone";
import { crmSourceLabel } from "./source";

type Props = {
  detail: CustomerDetail;
  canEdit: boolean;
};

function formatShortDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function formatOrderDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function CustomerDetailView({ detail, canEdit }: Props) {
  const wa = formatWhatsAppHref(detail.whatsappNumber ?? detail.phone);
  const mergeHref = detail.mergeHref && canEdit ? detail.mergeHref : null;

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/admin/customers"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← All customers
      </Link>

      <div className="pipeline-rail flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-milk/20 font-display text-2xl text-milk">
            {initialsFromName(detail.name)}
          </div>
          <div>
            <h1 className="font-display text-3xl font-light text-milk">
              {detail.name ?? "Customer"}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-milk/70">
              <span className="font-data">
                {maskPhone(detail.whatsappNumber ?? detail.phone)}
              </span>
              <span>·</span>
              <span className="text-[9.5px] uppercase tracking-[0.06em]">
                first contact:
              </span>
              <span className="border border-milk/25 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-milk/85">
                {crmSourceLabel(detail.firstContactSource)}
              </span>
              <span>·</span>
              <span className="border border-milk/20 bg-milk/10 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-milk/75">
                {detail.kind === "account"
                  ? "Account"
                  : "Guest — no login"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {wa ? (
            <a
              href={wa}
              target="_blank"
              rel="noopener noreferrer"
              className="border border-milk/25 px-4 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-milk hover:bg-milk/10"
            >
              Message on WhatsApp
            </a>
          ) : null}
          {mergeHref ? (
            <Link
              href={mergeHref}
              className="border border-milk/25 px-4 py-2.5 text-[11.5px] uppercase tracking-[0.06em] text-milk hover:bg-milk/10"
            >
              Merge with another record
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-ink/12 bg-ink/12 md:grid-cols-4">
        <Stat label="Orders" value={String(detail.totalOrdersCount)} />
        <Stat
          label="Lifetime value"
          value={<Money value={detail.lifetimeValueMinor} />}
          mono
        />
        <Stat
          label="Last order"
          value={formatShortDate(detail.lastOrderAt)}
        />
        <Stat
          label="COD refusals"
          value={String(detail.codRefusalCount)}
          alert={detail.codRefusalCount > 0}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_0.9fr]">
        <div className="flex flex-col gap-4">
          <section className="border border-ink/12 bg-milk p-5">
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
              Orders
            </h2>
            {detail.orders.length === 0 ? (
              <p className="text-[13px] text-ink/55">No orders yet.</p>
            ) : (
              <ul>
                {detail.orders.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-3 text-[13px] last:border-b-0"
                  >
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="font-data text-[12px] text-ink hover:text-madder"
                    >
                      {order.orderNumber}
                    </Link>
                    <span className="border border-ink/20 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.06em] text-ink/70">
                      {crmSourceLabel(order.source)}
                    </span>
                    <span className="text-[12px] text-ink/55">
                      {formatOrderDate(order.placedAt)}
                    </span>
                    <span className="border border-ink/25 px-2 py-0.5 text-[10px] uppercase tracking-[0.06em] text-ink/70">
                      {order.productionLabel}
                    </span>
                    <Money
                      value={order.totalMinor}
                      className="font-data text-[12px] text-ink"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="border border-ink/12 bg-milk p-5">
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
              Measurement profiles
            </h2>
            {detail.measurementProfiles.length === 0 ? (
              <p className="text-[13px] text-ink/55">No saved profiles.</p>
            ) : (
              <ul>
                {detail.measurementProfiles.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between border-b border-ink/10 py-2.5 text-[13px] text-ink last:border-b-0"
                  >
                    <span>
                      {p.label}
                      {p.isDefault ? (
                        <span className="ms-2 text-[11px] text-zari">
                          default
                        </span>
                      ) : null}
                      <span className="block text-[11px] text-ink/55">
                        {p.categoryName}
                      </span>
                    </span>
                    <span className="font-data text-[12px] text-ink/55">
                      last used {formatShortDate(p.updatedAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 border border-ink/12 bg-greige px-3 py-2.5 text-[11.5px] text-ink/70">
              Not in use while the storefront offers standard sizes only — the
              profile system is ready for made-to-measure whenever it returns.
            </p>
          </section>
        </div>

        <div className="flex flex-col gap-4">
          <section className="border border-ink/12 bg-milk p-5">
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
              Contact
            </h2>
            <Kv
              k="Phone"
              v={
                <span className="font-data">
                  {maskPhone(detail.phone ?? detail.whatsappNumber)}
                </span>
              }
            />
            <Kv
              k="WhatsApp"
              v={
                <span className="font-data">
                  {detail.whatsappNumber &&
                  normalizeSame(detail.whatsappNumber, detail.phone)
                    ? "same number"
                    : maskPhone(detail.whatsappNumber)}
                </span>
              }
            />
            <Kv k="Email" v={detail.email ?? "— not given"} />
            <Kv
              k="First order via"
              v={crmSourceLabel(detail.firstContactSource)}
            />
          </section>

          <section className="border border-ink/12 bg-milk p-5">
            <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
              Deliver to
            </h2>
            {detail.contactAddress ? (
              <div className="text-[13px] leading-relaxed text-ink/70">
                {detail.contactAddress.lines.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink/55">No address on file.</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function normalizeSame(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return a.replace(/\D/g, "") === b.replace(/\D/g, "");
}

function Stat({
  label,
  value,
  mono,
  alert,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
  alert?: boolean;
}) {
  return (
    <div className="bg-milk px-4 py-4">
      <div className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
        {label}
      </div>
      <div
        className={[
          "mt-1 font-display text-[1.9rem] font-light",
          mono ? "font-data text-[1.4rem]" : "",
          alert ? "text-madder" : "text-ink",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function Kv({ k, v }: { k: string; v: ReactNode }) {
  return (
    <div className="flex justify-between border-b border-ink/10 py-2 text-[13px] last:border-b-0">
      <span className="text-ink/55">{k}</span>
      <span className="text-ink">{v}</span>
    </div>
  );
}
