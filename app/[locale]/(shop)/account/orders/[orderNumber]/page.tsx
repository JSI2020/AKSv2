import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { getCustomerOrderByNumber } from "@/modules/orders/customer-queries";
import { ProductionTimeline } from "@/modules/orders/tracking/production-timeline";
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
        <p className="font-data text-[13px] uppercase tracking-[0.08em] text-ink/55">
          Order
        </p>
        <h1 className="mt-1 font-display text-[26px] font-medium text-ink md:text-[28px]">
          {order.orderNumber}
        </h1>

        <div className="mt-6 border border-greige-deep p-4">
          <p className="text-[13px] uppercase tracking-[0.08em] text-ink/55">
            Total
          </p>
          <Money value={order.totalMinor} className="mt-1 text-[18px] text-ink" />
        </div>

        <section className="mt-8">
          <h2 className="mb-4 text-[13px] uppercase tracking-[0.1em] text-ink/55">
            Where it is
          </h2>
          <ProductionTimeline steps={order.timeline} />
        </section>

        {order.customerNotes ? (
          <section className="mt-8 border border-greige-deep p-4">
            <h2 className="text-[13px] uppercase tracking-[0.1em] text-ink/55">
              Note from us
            </h2>
            <p className="mt-2 text-[15px] leading-relaxed text-ink/80">
              {order.customerNotes}
            </p>
          </section>
        ) : null}

        <section className="mt-8">
          <h2 className="mb-3 text-[13px] uppercase tracking-[0.1em] text-ink/55">
            Items
          </h2>
          <ul className="divide-y divide-greige-deep border-y border-greige-deep">
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
