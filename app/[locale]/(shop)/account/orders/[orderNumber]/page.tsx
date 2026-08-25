import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCustomerOrderByNumber } from "@/modules/orders/customer-queries";
import { CustomerOrderTracking } from "@/modules/orders/tracking/customer-order-tracking";
import { Money } from "@/modules/ui";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

type Props = {
  params: Promise<{ orderNumber: string }>;
};

export default async function AccountOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/track/${encodeURIComponent(orderNumber)}`);
  }

  const order = await getCustomerOrderByNumber(orderNumber);
  if (!order) notFound();

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-8 md:py-12">
        <CustomerOrderTracking order={order} />

        <div className="mx-auto mt-8 max-w-[560px] border border-ink/12 bg-milk p-4">
          <p className="text-[13px] uppercase tracking-[0.08em] text-ink/55">
            Total
          </p>
          <Money value={order.totalMinor} className="mt-1 text-[18px] text-ink" />
        </div>

        {order.customerNotes ? (
          <section className="mx-auto mt-6 max-w-[560px] border border-ink/12 bg-milk p-4">
            <h2 className="text-[13px] uppercase tracking-[0.1em] text-ink/55">
              Note from us
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              {order.customerNotes}
            </p>
          </section>
        ) : null}

        <section className="mx-auto mt-6 max-w-[560px]">
          <h2 className="mb-3 text-[13px] uppercase tracking-[0.1em] text-ink/55">
            Items
          </h2>
          <ul className="divide-y divide-ink/10 border-y border-ink/12">
            {order.items.map((item, index) => (
              <li key={`${item.designName}-${index}`} className="py-3">
                <p className="text-[15px] text-ink">{item.designName}</p>
                <p className="mt-1 text-[13px] text-ink/60">
                  {item.sizeMode === "MADE_TO_MEASURE"
                    ? "Made to your measurements"
                    : `Standard · ${item.sizeLabel ?? "—"}`}
                  {" · "}Qty {item.quantity}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </ShopPageContainer>
  );
}
