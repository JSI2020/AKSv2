import { getSiteSettings } from "@/modules/content";
import { AksLogoImage } from "@/modules/shop/shell/brand";
import type { CustomerOrderView } from "../customer-queries";
import { ProductionTimeline } from "./production-timeline";
import { isTerminalOrderStatus } from "../status";

function formatPromised(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
  }).format(value);
}

type CustomerOrderTrackingProps = {
  order: CustomerOrderView;
};

export async function CustomerOrderTracking({
  order,
}: CustomerOrderTrackingProps) {
  const settings = await getSiteSettings();
  const promised = order.promisedShipDate
    ? formatPromised(order.promisedShipDate)
    : null;
  const inFlight = !isTerminalOrderStatus(order.status);
  const promiseLine = promised
    ? inFlight
      ? `Promised by ${promised} · being made now`
      : `Promised by ${promised}`
    : inFlight
      ? "Being made now"
      : null;

  return (
    <div className="mx-auto max-w-[560px] overflow-hidden border border-ink/12 bg-milk">
      <div className="bg-milk px-8 py-8 text-center">
        <div className="mx-auto flex justify-center">
          <AksLogoImage size="lockup" />
        </div>
        <p className="mt-4 font-data text-[12px] text-ink/70">
          Order {order.orderNumber}
        </p>
        {promiseLine ? (
          <p className="mt-4 text-[13px] text-ink/85">{promiseLine}</p>
        ) : null}
      </div>

      <div className="px-8 py-8">
        <ProductionTimeline steps={order.timeline} photos={order.photos} />
      </div>

      <div className="border-t border-ink/12 px-8 py-5 text-center text-[12.5px] text-ink/55">
        Questions?{" "}
        <a
          href={settings.whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="text-madder hover:underline"
        >
          Message us on WhatsApp
        </a>{" "}
        — we reply quickly.
      </div>
    </div>
  );
}
