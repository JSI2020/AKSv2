import { notFound } from "next/navigation";

import { hasTrackAccess } from "@/modules/messaging";
import { getTrackedOrderByNumber } from "@/modules/orders/customer-queries";
import { ProductionTimeline } from "@/modules/orders/tracking/production-timeline";
import { TrackGateForm } from "@/modules/orders/tracking/track-gate-form";
import { Money } from "@/modules/ui";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

type Props = {
  params: Promise<{ orderNumber: string }>;
};

export default async function TrackOrderPage({ params }: Props) {
  const { orderNumber } = await params;
  const allowed = await hasTrackAccess(orderNumber);

  if (!allowed) {
    return (
      <ShopPageContainer>
        <div className="mx-auto max-w-[640px] py-8 md:py-12">
          <h1 className="font-display text-[26px] font-medium text-ink md:text-[28px]">
            Track your order
          </h1>
          <p className="mt-2 font-data text-[14px] text-ink/70">{orderNumber}</p>
          <div className="mt-6">
            <TrackGateForm orderNumber={orderNumber} />
          </div>
        </div>
      </ShopPageContainer>
    );
  }

  const order = await getTrackedOrderByNumber(orderNumber);
  if (!order) notFound();

  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[640px] py-8 md:py-12">
        <p className="font-data text-[13px] uppercase tracking-[0.08em] text-ink/55">
          Tracking
        </p>
        <h1 className="mt-1 font-display text-[26px] font-medium text-ink md:text-[28px]">
          {order.orderNumber}
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
          Made to order — here&apos;s where yours is in the workshop.
        </p>

        <section className="mt-8">
          <h2 className="mb-4 text-[13px] uppercase tracking-[0.1em] text-ink/55">
            Production
          </h2>
          <ProductionTimeline steps={order.timeline} />
        </section>

        <div className="mt-8 border border-greige-deep p-4">
          <p className="text-[13px] uppercase tracking-[0.08em] text-ink/55">
            Total
          </p>
          <Money value={order.totalMinor} className="mt-1 text-[18px] text-ink" />
        </div>

        {order.photos.length > 0 ? (
          <section className="mt-8">
            <h2 className="mb-3 text-[13px] uppercase tracking-[0.1em] text-ink/55">
              From the workshop
            </h2>
            <ul className="grid grid-cols-2 gap-3">
              {order.photos.map((photo, index) => (
                <li key={`${photo.stage}-${index}`}>
                  {photo.readUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo.readUrl}
                      alt={photo.stage}
                      className="aspect-square w-full object-cover"
                    />
                  ) : null}
                  <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-ink/55">
                    {photo.stage}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </ShopPageContainer>
  );
}
