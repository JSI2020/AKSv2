import { notFound } from "next/navigation";

import { Link } from "@/i18n/routing";
import { readBankTransferConfigOrNull } from "@/modules/payments/bank-transfer/config";
import { getOrderForBankTransfer } from "@/modules/payments/bank-transfer/queries";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

import { BankTransferPayForm } from "@/modules/checkout/bank-transfer-pay-form";

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function CheckoutPayPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderNumber = params.order?.trim();

  if (!orderNumber) {
    notFound();
  }

  const order = await getOrderForBankTransfer(orderNumber);
  if (!order) {
    notFound();
  }

  const bank = readBankTransferConfigOrNull();

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-12">
        <Link
          href={`/checkout/confirmation?order=${encodeURIComponent(orderNumber)}`}
          className="text-[12px] uppercase tracking-[0.08em] text-ink/55"
        >
          Back to confirmation
        </Link>
        <h1 className="mt-4 font-display text-[28px] font-medium text-ink">
          Pay by bank transfer
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink/75">
          Order {orderNumber} — transfer your deposit, then upload the receipt
          below.
        </p>

        {!bank ? (
          <p className="mt-8 border border-madder/40 bg-madder/5 px-4 py-3 text-[14px] text-ink">
            Bank transfer details are not configured. Please contact the studio
            to complete your deposit, or try again later.
          </p>
        ) : (
          <div className="mt-8">
            <BankTransferPayForm
              order={{
                orderNumber: order.orderNumber,
                depositAmountMinor: order.depositAmountMinor,
                hasPendingVerification: order.hasPendingVerification,
                status: order.status,
              }}
              bank={bank}
            />
          </div>
        )}
      </div>
    </ShopPageContainer>
  );
}
