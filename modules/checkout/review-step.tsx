"use client";

import { useEffect, useState, useTransition } from "react";

import type { CartPublic } from "@/modules/cart";
import { Money } from "@/modules/ui";

import { validateCheckoutCart } from "./actions";
import {
  computeDepositAmounts,
  provinceLabel,
  type PaymentPlan,
} from "./payment-plans";
import type { CheckoutAddressInput, CheckoutDiscountPreview } from "./types";

type Props = {
  cart: CartPublic;
  address: CheckoutAddressInput;
  paymentPlan: PaymentPlan;
  discountPreview: CheckoutDiscountPreview | null;
  customerNotes: string;
  pending: boolean;
  onCustomerNotesChange: (value: string) => void;
  onBack: () => void;
  onPlaceOrder: () => void;
};

function sizeLabel(line: {
  sizeMode: "STANDARD" | "MADE_TO_MEASURE";
  sizeLabel: string | null;
}) {
  if (line.sizeMode === "MADE_TO_MEASURE") return "Made to measure";
  return line.sizeLabel ?? "Standard";
}

export function ReviewStep({
  cart,
  address,
  paymentPlan,
  discountPreview,
  customerNotes,
  pending,
  onCustomerNotesChange,
  onBack,
  onPlaceOrder,
}: Props) {
  const [checking, startCheck] = useTransition();
  const [validationError, setValidationError] = useState<string | null>(null);
  const [validationIssues, setValidationIssues] = useState<string[]>([]);
  const [subtotalMinor, setSubtotalMinor] = useState(cart.subtotalMinor);

  useEffect(() => {
    startCheck(async () => {
      const result = await validateCheckoutCart();
      if (!result.ok) {
        setValidationError(
          "Something changed since you started checkout. Review before placing your order.",
        );
        setValidationIssues(result.issues.map((i) => i.message));
        return;
      }
      setValidationError(null);
      setValidationIssues([]);
      setSubtotalMinor(result.subtotalMinor);
    });
  }, []);

  const totalMinor = discountPreview?.totalMinor ?? subtotalMinor;
  const discountMinor = discountPreview?.discountMinor ?? 0;
  const amounts = computeDepositAmounts({ totalMinor, plan: paymentPlan });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-[20px] text-ink">Review and place</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink/65">
          We check prices and availability one last time before your order is
          created.
        </p>
      </div>

      {(validationError || validationIssues.length > 0) && (
        <div
          className="border border-madder px-4 py-3 text-[14px] text-madder"
          role="alert"
        >
          {validationError ? <p>{validationError}</p> : null}
          {validationIssues.length > 0 ? (
            <ul className="mt-2 list-disc ps-5">
              {validationIssues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      )}

      <section className="border border-greige-deep p-4">
        <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Delivery
        </h3>
        <p className="mt-2 text-[15px] text-ink">{address.recipientName}</p>
        <p className="text-[14px] text-ink/70">{address.phone}</p>
        <p className="text-[14px] text-ink/70">
          WhatsApp: {address.whatsappNumber}
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/75">
          {address.addressLine1}
          {address.addressLine2 ? `, ${address.addressLine2}` : ""}
          <br />
          {address.city}, {provinceLabel(address.province)}
          {address.postalCode ? ` ${address.postalCode}` : ""}
          {address.landmark ? (
            <>
              <br />
              Near {address.landmark}
            </>
          ) : null}
        </p>
      </section>

      <section className="border border-greige-deep p-4">
        <h3 className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Items
        </h3>
        <ul className="mt-3 space-y-3">
          {cart.lines.map((line) => (
            <li
              key={line.id}
              className="flex items-start justify-between gap-3 text-[14px]"
            >
              <div>
                <p className="text-ink">{line.designName}</p>
                <p className="text-ink/65">
                  {line.colourwayName} · {sizeLabel(line)} · Qty {line.quantity}
                </p>
              </div>
              <Money value={line.lineTotalMinor} />
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-between border-t border-greige-deep pt-3 text-[15px]">
          <span>Subtotal</span>
          <Money value={subtotalMinor} />
        </div>
        {discountMinor > 0 ? (
          <div className="mt-2 flex justify-between text-[14px] text-ink/70">
            <span>
              Discount{discountPreview?.code ? ` (${discountPreview.code})` : ""}
            </span>
            <span>
              −<Money value={discountMinor} className="inline" />
            </span>
          </div>
        ) : null}
        <div className="mt-2 flex justify-between text-[15px]">
          <span>Order total</span>
          <Money value={totalMinor} />
        </div>
        <div className="mt-2 flex justify-between text-[14px] text-ink/70">
          <span>Deposit due now</span>
          <Money value={amounts.depositAmountMinor} />
        </div>
        {amounts.balanceAmountMinor > 0 ? (
          <div className="mt-1 flex justify-between text-[14px] text-ink/70">
            <span>Balance on delivery</span>
            <Money value={amounts.balanceAmountMinor} />
          </div>
        ) : null}
      </section>

      <div>
        <label htmlFor="customerNotes" className="mb-1.5 block text-[12px] uppercase tracking-[0.06em] text-ink/55">
          Notes (optional)
        </label>
        <textarea
          id="customerNotes"
          rows={3}
          className="w-full border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink"
          value={customerNotes}
          onChange={(e) => onCustomerNotesChange(e.target.value)}
          placeholder="Delivery instructions, timing preferences, anything we should know."
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onBack}
          disabled={pending}
          className="btn-secondary"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onPlaceOrder}
          disabled={pending || checking || validationIssues.length > 0}
          className="btn-primary"
        >
          {pending ? "Placing order…" : "Place order"}
        </button>
      </div>
    </div>
  );
}
