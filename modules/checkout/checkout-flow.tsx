"use client";

import { useState, useTransition } from "react";

import { Link, useRouter } from "@/i18n/routing";
import { Money } from "@/modules/ui";
import type { CartPublic } from "@/modules/cart";

import { placeOrder } from "./actions";
import { AddressStep } from "./address-step";
import { DiscountCodeField } from "./discount-code-field";
import { PaymentStep } from "./payment-step";
import { ReviewStep } from "./review-step";
import { trackCheckoutStarted, trackOrderPlaced } from "@/modules/analytics";
import type { PaymentPlan } from "./payment-plans";
import type { CheckoutAddressInput, CheckoutDiscountPreview, CheckoutStep } from "./types";

type Props = {
  cart: CartPublic;
  isSignedIn: boolean;
  codDisabled?: boolean;
};

const STEPS: { key: CheckoutStep; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
];

export function CheckoutFlow({ cart, isSignedIn, codDisabled = false }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<CheckoutStep>("address");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const [address, setAddress] = useState<CheckoutAddressInput>({
    recipientName: "",
    phone: "",
    whatsappNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "PUNJAB",
    postalCode: "",
    landmark: "",
    guestEmail: "",
    saveAddress: false,
    addressLabel: "Home",
  });

  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan | null>(null);
  const [discountCode, setDiscountCode] = useState("");
  const [discountPreview, setDiscountPreview] =
    useState<CheckoutDiscountPreview | null>(null);
  const [customerNotes, setCustomerNotes] = useState("");

  function goToPayment(nextAddress: CheckoutAddressInput) {
    setAddress(nextAddress);
    setError(null);
    setStep("payment");
  }

  function goToReview(plan: PaymentPlan) {
    setPaymentPlan(plan);
    setError(null);
    setStep("review");
    trackCheckoutStarted({
      itemCount: cart.lines.length,
      totalMinor: cart.subtotalMinor,
    });
  }

  function handlePlaceOrder() {
    if (!paymentPlan) return;
    setError(null);
    setIssues([]);

    startTransition(async () => {
      const result = await placeOrder({
        address,
        paymentPlan,
        customerNotes,
        discountCode: discountPreview?.code ?? (discountCode.trim() || null),
      });

      if (!result.ok) {
        setError(result.error);
        setIssues(result.issues ?? []);
        return;
      }

      trackOrderPlaced({
        orderNumber: result.orderNumber,
        designIds: cart.lines.map((item) => item.designId),
        totalMinor: discountPreview?.totalMinor ?? cart.subtotalMinor,
      });

      router.push(`/checkout/confirmation?order=${encodeURIComponent(result.orderNumber)}`);
    });
  }

  return (
    <div className="mx-auto w-full max-w-[720px]">
      <header className="mb-8 border-b border-greige-deep pb-6">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.08em] text-ink/55"
        >
          Continue shopping
        </Link>
        <h1 className="mt-3 font-display text-[28px] font-medium text-ink">
          Checkout
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
          No account needed — we will ask if you want to save one after your
          order is placed.
        </p>

        <ol className="mt-6 flex flex-wrap gap-2">
          {STEPS.map((item, index) => {
            const active = item.key === step;
            const done =
              (item.key === "address" && step !== "address") ||
              (item.key === "payment" && step === "review");
            return (
              <li
                key={item.key}
                className={
                  active
                    ? "border border-ink bg-ink px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-greige"
                    : done
                      ? "border border-greige-deep px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink/70"
                      : "border border-greige-deep px-3 py-1.5 text-[11px] uppercase tracking-[0.08em] text-ink/45"
                }
              >
                {index + 1}. {item.label}
              </li>
            );
          })}
        </ol>
      </header>

      <aside className="mb-8 border border-greige-deep p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] uppercase tracking-[0.08em] text-ink/55">
            Cart total
          </span>
          <Money value={cart.subtotalMinor} className="text-[18px] text-ink" />
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/65">
          {cart.leadTimeLabel}
        </p>
      </aside>

      {error ? (
        <div
          className="mb-6 border border-madder bg-greige px-4 py-3 text-[14px] text-madder"
          role="alert"
        >
          <p>{error}</p>
          {issues.length > 0 ? (
            <ul className="mt-2 list-disc ps-5">
              {issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {step === "address" ? (
        <AddressStep
          initial={address}
          isSignedIn={isSignedIn}
          onContinue={goToPayment}
        />
      ) : null}

      {step === "payment" ? (
        <PaymentStep
          lines={cart.lines.map((line) => ({ sizeMode: line.sizeMode }))}
          subtotalMinor={cart.subtotalMinor}
          selected={paymentPlan}
          codDisabled={codDisabled}
          discountCode={discountCode}
          discountPreview={discountPreview}
          onDiscountCodeChange={setDiscountCode}
          onDiscountApplied={setDiscountPreview}
          onBack={() => setStep("address")}
          onContinue={goToReview}
        />
      ) : null}

      {step === "review" && paymentPlan ? (
        <ReviewStep
          cart={cart}
          address={address}
          paymentPlan={paymentPlan}
          discountPreview={discountPreview}
          customerNotes={customerNotes}
          pending={pending}
          onCustomerNotesChange={setCustomerNotes}
          onBack={() => setStep("payment")}
          onPlaceOrder={handlePlaceOrder}
        />
      ) : null}
    </div>
  );
}
