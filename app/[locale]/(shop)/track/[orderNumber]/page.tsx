import { notFound } from "next/navigation";

import { hasTrackAccess } from "@/modules/messaging";
import { getTrackedOrderByNumber } from "@/modules/orders/customer-queries";
import { CustomerOrderTracking } from "@/modules/orders/tracking/customer-order-tracking";
import { TrackGateForm } from "@/modules/orders/tracking/track-gate-form";
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
        <div className="mx-auto max-w-[560px] py-8 md:py-12">
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
      <div className="py-8 md:py-12">
        <CustomerOrderTracking order={order} />
      </div>
    </ShopPageContainer>
  );
}
