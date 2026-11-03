import { pageMetadata } from "@/modules/seo/metadata";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";
import { TrackLookupForm } from "@/modules/orders/tracking/track-lookup-form";

export const metadata = pageMetadata({
  title: "Track your order",
  description:
    "Track an AKS-Atelier order with the order number and the email or phone from checkout.",
  path: "/track",
});

export default function TrackLookupPage() {
  return (
    <ShopPageContainer>
      <div className="mx-auto max-w-[560px] py-8 md:py-12">
        <h1 className="font-display text-[26px] font-medium text-ink md:text-[28px]">
          Track your order
        </h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink/70">
          Use the order number from your confirmation, and the email or phone
          you gave at checkout.
        </p>
        <div className="mt-6">
          <TrackLookupForm />
        </div>
      </div>
    </ShopPageContainer>
  );
}
