import { Link } from "@/i18n/routing";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

type Props = {
  searchParams: Promise<{ order?: string }>;
};

export default async function CheckoutConfirmationPage({ searchParams }: Props) {
  const params = await searchParams;
  const orderNumber = params.order ?? "";

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-12">
        <h1 className="font-display text-[28px] font-medium text-ink">
          It&apos;s begun
        </h1>
        <p className="mt-3 text-[16px] leading-relaxed text-ink/75">
          We&apos;ll cut, stitch, and keep you posted at every step — no need to
          wonder where it is.
        </p>

        {orderNumber ? (
          <p className="mt-6 font-data text-[15px] text-ink">
            Order {orderNumber}
          </p>
        ) : null}

        <p className="mt-6 text-[15px] leading-relaxed text-ink/70">
          Payment comes next — for now your order is saved and waiting for
          deposit. We&apos;ll reach you on WhatsApp with what to do.
        </p>

        <div className="mt-8 space-y-3">
          <p className="text-[14px] text-ink/65">
            Want order history and saved measurements? Create an account after
            this — we never ask before you order.
          </p>
          <Link
            href="/"
            className="inline-block border border-ink bg-ink px-4 py-3 text-[12px] uppercase tracking-[0.08em] text-greige"
          >
            Back to shop
          </Link>
        </div>
      </div>
    </ShopPageContainer>
  );
}
