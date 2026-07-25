import { Eyebrow } from "@/modules/ui";
import { listAwaitingVerificationPayments } from "@/modules/payments/bank-transfer/queries";
import { VerificationQueue } from "@/modules/payments/admin/verification-queue";

export default async function PaymentVerificationPage() {
  const items = await listAwaitingVerificationPayments();

  return (
    <div>
      <Eyebrow>Payments</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">
        Bank transfer verification
      </h1>
      <p className="mt-2 max-w-[640px] text-[13px] leading-relaxed text-chalk">
        Receipt beside expected amount — verify to advance the order, or reject
        with a reason so the customer can try again.
      </p>
      <div className="mt-6">
        <VerificationQueue items={items} />
      </div>
    </div>
  );
}
