"use client";

import { useState, useTransition } from "react";

import { Money } from "@/modules/ui";

import { applyCheckoutDiscount } from "./actions";
import type { CheckoutDiscountPreview } from "./types";
import type { PaymentPlan } from "./payment-plans";

type Props = {
  code: string;
  onCodeChange: (value: string) => void;
  paymentPlan: PaymentPlan | null;
  applied: CheckoutDiscountPreview | null;
  onApplied: (preview: CheckoutDiscountPreview | null) => void;
};

export function DiscountCodeField({
  code,
  onCodeChange,
  paymentPlan,
  applied,
  onApplied,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleApply(event: React.FormEvent) {
    event.preventDefault();
    if (!paymentPlan) {
      setError("Choose a payment plan before applying a code.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await applyCheckoutDiscount({
        code,
        paymentPlan,
      });

      if (!result.ok) {
        setError(result.error);
        onApplied(null);
        return;
      }

      onApplied(result.preview);
    });
  }

  function handleClear() {
    onCodeChange("");
    setError(null);
    onApplied(null);
  }

  return (
    <div className="border border-greige-deep p-4">
      <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
        Discount code
      </h3>
      <form onSubmit={handleApply} className="mt-3 flex flex-col gap-3 sm:flex-row">
        <input
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder="Enter code"
          className="min-w-0 flex-1 border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
        />
        <button
          type="submit"
          disabled={pending || !code.trim()}
          className="border border-ink px-4 py-2.5 text-[12px] uppercase tracking-[0.08em] text-ink disabled:opacity-40"
        >
          {pending ? "Checking…" : "Apply"}
        </button>
      </form>

      {applied ? (
        <p className="mt-2 text-[13px] text-ink/70">
          <span className="uppercase">{applied.code}</span> applied —{" "}
          <Money value={applied.discountMinor} className="inline" /> off · Total{" "}
          <Money value={applied.totalMinor} className="inline" />
          <button
            type="button"
            onClick={handleClear}
            className="ms-2 underline"
          >
            Remove
          </button>
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
