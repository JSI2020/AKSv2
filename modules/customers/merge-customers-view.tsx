"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { mergeCustomers } from "./actions";
import type { MergeCandidate } from "./types";
import { maskPhone, phoneHammingDistance } from "./phone";
import { crmSourceLabel } from "./source";

type Props = {
  cardA: MergeCandidate;
  cardB: MergeCandidate | null;
  candidates: MergeCandidate[];
};

export function MergeCustomersView({ cardA, cardB, candidates }: Props) {
  const router = useRouter();
  const [bRef, setBRef] = useState(cardB?.ref ?? "");
  const [survivor, setSurvivor] = useState<"A" | "B">("A");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const resolvedB = useMemo(() => {
    if (cardB && (!bRef || bRef === cardB.ref)) return cardB;
    return candidates.find((c) => c.ref === bRef) ?? cardB;
  }, [bRef, cardB, candidates]);

  const phoneDiffers =
    resolvedB &&
    cardA.phoneDigits.length === resolvedB.phoneDigits.length &&
    phoneHammingDistance(cardA.phoneDigits, resolvedB.phoneDigits) === 1;

  const survivorCard = survivor === "A" ? cardA : resolvedB;
  const loserCard = survivor === "A" ? resolvedB : cardA;

  const consequence =
    survivorCard && loserCard
      ? `${loserCard.name ?? "Loser"}'s ${loserCard.totalOrdersCount} order${
          loserCard.totalOrdersCount === 1 ? "" : "s"
        } and address will move to ${survivorCard.name ?? "survivor"}. ${
          loserCard.name ?? "That record"
        }'s record stays on file, flagged as merged — nothing is deleted.`
      : "Select the second record to merge.";

  function onConfirm() {
    if (!resolvedB) {
      setError("Select another record to merge.");
      return;
    }
    const survivorRef = survivor === "A" ? cardA.ref : resolvedB.ref;
    const loserRef = survivor === "A" ? resolvedB.ref : cardA.ref;
    setError(null);
    startTransition(async () => {
      const result = await mergeCustomers({ survivorRef, loserRef });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(result.href);
    });
  }

  return (
    <div>
      <Link
        href="/admin/customers"
        className="font-sans text-[12px] text-ink/55 hover:text-zari"
      >
        ← All customers
      </Link>
      <p className="mt-4 font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
        Customers · Merge
      </p>
      <h1 className="mt-1 font-display text-3xl font-light text-ink">
        Merge two records
      </h1>
      <p className="mt-2 max-w-[640px] text-[13px] text-ink/70">
        Choose the record that survives — orders, addresses, and profiles move
        to it. The other is kept, flagged, never deleted.
      </p>

      {!resolvedB ? (
        <div className="mt-6">
          <label className="text-[11px] uppercase tracking-[0.1em] text-ink/55">
            Merge with
          </label>
          <select
            value={bRef}
            onChange={(e) => {
              const ref = e.target.value;
              setBRef(ref);
              if (ref) {
                router.replace(
                  `/admin/customers/merge?a=${encodeURIComponent(cardA.ref)}&b=${encodeURIComponent(ref)}`,
                );
              }
            }}
            className="mt-2 w-full max-w-md border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink"
          >
            <option value="">Select a customer…</option>
            {candidates.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.name ?? c.phoneDigits} · {c.kind} · {c.totalOrdersCount}{" "}
                orders
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-8 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-start">
        <MergeCard
          card={cardA}
          isSurvivor={survivor === "A"}
          onPick={() => setSurvivor("A")}
          phoneWarn={false}
        />
        <div className="hidden self-center px-2 pt-10 text-center font-display text-lg italic text-ink/55 md:block">
          merged into
        </div>
        {resolvedB ? (
          <MergeCard
            card={resolvedB}
            isSurvivor={survivor === "B"}
            onPick={() => setSurvivor("B")}
            phoneWarn={!!phoneDiffers}
          />
        ) : (
          <div className="border border-dashed border-ink/20 p-6 text-[13px] text-ink/55">
            Select the other record above.
          </div>
        )}
      </div>

      <div className="mt-6 border border-ink/12 bg-greige px-4 py-3 text-[12.5px] text-ink/70">
        {consequence}
      </div>

      {error ? (
        <p className="mt-3 text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !resolvedB}
          onClick={onConfirm}
          className="bg-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-milk hover:bg-madder disabled:opacity-40"
        >
          {pending ? "Merging…" : "Confirm merge"}
        </button>
        <Link
          href={
            cardA.kind === "account" && cardA.userId
              ? `/admin/customers/${cardA.userId}`
              : `/admin/customers/guest/${encodeURIComponent(cardA.phoneDigits)}`
          }
          className="border border-ink/20 px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink hover:border-ink"
        >
          Cancel
        </Link>
      </div>
    </div>
  );
}

function MergeCard({
  card,
  isSurvivor,
  onPick,
  phoneWarn,
}: {
  card: MergeCandidate;
  isSurvivor: boolean;
  onPick: () => void;
  phoneWarn: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={[
        "w-full border-2 p-5 text-start transition-colors",
        isSurvivor
          ? "border-ink bg-milk"
          : "border-ink/15 bg-greige hover:border-ink/40",
      ].join(" ")}
    >
      <span
        className={[
          "mb-2 block text-[9px] uppercase tracking-[0.1em] text-ink/55",
          isSurvivor ? "visible" : "invisible",
        ].join(" ")}
      >
        Will survive
      </span>
      <div className="font-display text-2xl text-ink">
        {card.name ?? "Customer"}
      </div>
      <div className="mt-3 space-y-1 text-[12.5px]">
        <div className="flex justify-between gap-2">
          <span className="text-ink/55">Phone</span>
          <span className="font-data text-ink">
            {maskPhone(card.phoneDisplay ?? card.phoneDigits)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/55">First contact</span>
          <span className="text-ink">
            {crmSourceLabel(card.firstContactSource)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/55">Orders</span>
          <span className="text-ink">{card.totalOrdersCount}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-ink/55">LTV</span>
          <span className="font-data text-ink">
            <Money value={card.lifetimeValueMinor} />
          </span>
        </div>
        {card.addressSummary ? (
          <div className="flex justify-between gap-2">
            <span className="text-ink/55">Address</span>
            <span className="text-end text-ink">{card.addressSummary}</span>
          </div>
        ) : null}
      </div>
      {phoneWarn ? (
        <div className="mt-3 bg-zari/15 px-2 py-1.5 text-[11px] text-zari">
          ⚠ Phone differs by one digit — likely the same person
        </div>
      ) : null}
    </button>
  );
}
