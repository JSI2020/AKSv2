"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import {
  confirmPhoneMatch,
  createCustomerFromPhone,
} from "./actions";
import { findPhoneMatches } from "./queries";
import { initialsFromName, maskPhone, normalizePhoneDigits } from "./phone";
import {
  CRM_SOURCES,
  CRM_SOURCE_LABEL,
  crmSourceLabel,
  type CrmSourceFilter,
} from "./source";
import type {
  CustomerDirectoryRow,
  PhoneMatchCandidate,
} from "./types";

type Props = {
  rows: CustomerDirectoryRow[];
  duplicatePairCount: number;
  initialQuery: string;
  initialSource: CrmSourceFilter;
  canEdit: boolean;
};

export function CustomersDirectoryView({
  rows,
  duplicatePairCount,
  initialQuery,
  initialSource,
  canEdit,
}: Props) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [source, setSource] = useState<CrmSourceFilter>(initialSource);
  const [matches, setMatches] = useState<PhoneMatchCandidate[]>([]);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const digits = normalizePhoneDigits(query);
    if (digits.length < 10) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    void findPhoneMatches(query).then((m) => {
      if (!cancelled) setMatches(m);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  function pushFilters(nextQ: string, nextSource: CrmSourceFilter) {
    const params = new URLSearchParams();
    if (nextQ.trim()) params.set("q", nextQ.trim());
    if (nextSource !== "ALL") params.set("source", nextSource);
    const qs = params.toString();
    router.push(qs ? `/admin/customers?${qs}` : "/admin/customers");
  }

  function onSearchChange(value: string) {
    setQuery(value);
    startTransition(() => {
      pushFilters(value, source);
    });
  }

  function onSourceChip(next: CrmSourceFilter) {
    setSource(next);
    startTransition(() => {
      pushFilters(query, next);
    });
  }

  function focusNew() {
    searchRef.current?.focus();
    setError(null);
  }

  async function onThisIsHer(match: PhoneMatchCandidate) {
    if (!canEdit) return;
    setError(null);
    const result = await confirmPhoneMatch({
      userId: match.userId,
      guestDigits: match.kind === "guest" ? match.phoneDigits : null,
      typedPhone: query,
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.href);
  }

  async function onDifferentPerson(match: PhoneMatchCandidate) {
    if (!canEdit) return;
    setError(null);
    const result = await createCustomerFromPhone({
      phone: query,
      conflictWithName: match.name,
      conflictWithDigits: match.phoneDigits,
      source: "PHONE",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.href);
  }

  async function onCreateWhenNoMatch() {
    if (!canEdit) return;
    const digits = normalizePhoneDigits(query);
    if (digits.length < 10) {
      setError("Type a phone number (10+ digits) to create a customer.");
      searchRef.current?.focus();
      return;
    }
    if (matches.length > 0) {
      setError(
        "Confirm the match above, or choose “Different person, same phone”.",
      );
      return;
    }
    setError(null);
    const result = await createCustomerFromPhone({
      phone: digits,
      source: "PHONE",
    });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(result.href);
  }

  const chips: { key: CrmSourceFilter; label: string }[] = [
    { key: "ALL", label: "All" },
    ...CRM_SOURCES.map((s) => ({
      key: s as CrmSourceFilter,
      label: CRM_SOURCE_LABEL[s],
    })),
    {
      key: "DUPLICATES",
      label: `Possible duplicates · ${duplicatePairCount}`,
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
            Sell · Customers
          </p>
          <h1 className="mt-1 font-display text-3xl font-light text-ink">
            Customers
          </h1>
          <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-ink/70">
            Matched by phone number — one record, however she ordered.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/customers/subscribers"
            className="border border-ink/15 px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink/60 hover:border-ink hover:text-ink"
          >
            Subscribers
          </Link>
          {canEdit ? (
            <button
              type="button"
              onClick={() => {
                focusNew();
                const digits = normalizePhoneDigits(query);
                if (digits.length >= 10 && matches.length === 0) {
                  void onCreateWhenNoMatch();
                }
              }}
              className="bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk hover:bg-madder"
            >
              + New customer
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search by phone, name, or email…"
          className="w-full border border-ink/12 bg-milk px-4 py-3 text-[14px] text-ink outline-none placeholder:text-ink/40 focus:border-ink"
        />
        <p className="mt-2 text-[11.5px] text-ink/55">
          Type a full phone (≥10 digits) to see close matches — exact or one
          digit off.
        </p>
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      {matches.length > 0 ? (
        <div className="mt-4 border border-zari bg-milk px-5 py-4">
          <p className="mb-3 text-[10px] uppercase tracking-[0.14em] text-zari">
            Possible match on this phone number
          </p>
          {matches.map((match) => (
            <div
              key={`${match.kind}-${match.phoneDigits}-${match.userId ?? ""}`}
              className="flex flex-wrap items-center justify-between gap-4 py-2"
            >
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-full bg-greige-deep font-display text-lg text-ink">
                  {initialsFromName(match.name)}
                </div>
                <div>
                  <div className="font-display text-xl text-ink">
                    {match.name ?? "Customer"}
                  </div>
                  <div className="font-data text-[11.5px] text-ink/60">
                    {match.phoneDisplay ?? match.phoneDigits}
                    {" · "}
                    {match.totalOrdersCount} previous order
                    {match.totalOrdersCount === 1 ? "" : "s"}
                    {match.distance === 1 ? " · close match" : ""}
                  </div>
                </div>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void onThisIsHer(match)}
                    className="bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-milk hover:bg-madder"
                  >
                    This is her
                  </button>
                  <button
                    type="button"
                    onClick={() => void onDifferentPerson(match)}
                    className="border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink hover:border-ink"
                  >
                    Different person, same phone
                  </button>
                </div>
              ) : (
                <Link
                  href={match.href}
                  className="border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink hover:border-zari"
                >
                  Open
                </Link>
              )}
            </div>
          ))}
          <p className="mt-3 text-[11px] text-ink/55">
            This screen only matches or creates a customer record. Order
            placement always happens through checkout — never here.
          </p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map((chip) => {
          const on = source === chip.key;
          const dup = chip.key === "DUPLICATES";
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => onSourceChip(chip.key)}
              className={[
                "border px-3 py-2 text-[11.5px] tracking-[0.03em]",
                on
                  ? "border-ink bg-ink text-milk"
                  : dup
                    ? "border-madder text-madder"
                    : "border-ink/20 text-ink/70 hover:border-ink hover:text-ink",
              ].join(" ")}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 overflow-x-auto border border-ink/12 bg-milk">
        {pending ? (
          <p className="px-4 py-3 text-[12px] text-ink/55">Updating…</p>
        ) : null}
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-ink/55">No customers match.</p>
        ) : (
          <table className="w-full min-w-[44rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-ink/12 bg-greige text-ink/55">
                <th className="px-4 py-3 text-start text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  Customer
                </th>
                <th className="px-4 py-3 text-start text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  Phone
                </th>
                <th className="px-4 py-3 text-start text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  First contact
                </th>
                <th className="px-4 py-3 text-start text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  Account
                </th>
                <th className="px-4 py-3 text-start text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  Orders
                </th>
                <th className="px-4 py-3 text-end text-[9.5px] font-normal uppercase tracking-[0.12em]">
                  Lifetime value
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={
                    row.kind === "account"
                      ? `a-${row.userId}`
                      : `g-${row.phoneDigits}`
                  }
                  className="cursor-pointer border-b border-ink/10 hover:bg-greige/80"
                  onClick={() => router.push(row.href)}
                >
                  <td className="px-4 py-3 text-ink">{row.name ?? "—"}</td>
                  <td className="px-4 py-3 font-data text-[12px] text-ink/70">
                    {maskPhone(row.phoneDisplay ?? row.phoneDigits)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="border border-ink/20 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em] text-ink/70">
                      {crmSourceLabel(row.firstContactSource)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={[
                        "px-2 py-0.5 text-[9.5px] uppercase tracking-[0.06em]",
                        row.kind === "account"
                          ? "bg-ink/8 text-ink"
                          : "border border-ink/20 text-ink/70",
                      ].join(" ")}
                    >
                      {row.kind === "account" ? "Account" : "Guest"}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-data text-ink">
                    {row.totalOrdersCount}
                  </td>
                  <td className="px-4 py-3 text-end font-data text-[12.5px] text-ink">
                    <Money value={row.lifetimeValueMinor} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
