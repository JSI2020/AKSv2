import { getSiteSettings } from "@/modules/content";
import { AksLogoImage } from "@/modules/shop/shell/brand";
import { Money } from "@/modules/ui";
import type { CustomerOrderView } from "../customer-queries";
import { ProductionTimeline } from "./production-timeline";
import { isTerminalOrderStatus, paymentStatusLabel } from "../status";

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
  const currentStep = order.timeline.find((step) => step.state === "current");
  const pastMaking =
    order.status === "READY_TO_SHIP" ||
    order.status === "DISPATCHED" ||
    order.status === "DELIVERED" ||
    order.status === "COMPLETED" ||
    !inFlight;
  const promiseLine = pastMaking
    ? (currentStep?.message ?? null)
    : promised
      ? `Promised by ${promised} · being made now`
      : (currentStep?.message ?? "Being made now");
  const paymentLabel = paymentStatusLabel({
    status: order.status,
    balanceAmountMinor: order.balanceAmountMinor,
    paidMinor: order.paidMinor,
    totalMinor: order.totalMinor,
    paymentPlan: order.paymentPlan,
  });

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
        <p className="mt-2 text-[13px] text-ink/70">{paymentLabel}</p>
      </div>

      <div className="border-t border-ink/12 px-8 py-5">
        <p className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
          Pieces
        </p>
        <ul className="mt-3 space-y-2">
          {order.items.map((item, index) => (
            <li
              key={`${item.designName}-${item.sizeLabel ?? "size"}-${index}`}
              className="flex items-baseline justify-between gap-4 text-[15px] text-ink"
            >
              <span>
                {item.designName}
                {item.sizeLabel ? ` · ${item.sizeLabel}` : ""}
                {item.quantity > 1 ? ` · ×${item.quantity}` : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-baseline justify-between gap-4 border-t border-ink/12 pt-3 text-[15px]">
          <span className="text-ink/55">Total</span>
          <Money value={order.totalMinor} />
        </div>
      </div>

      <div className="px-8 py-8">
        <ProductionTimeline steps={order.timeline} photos={order.photos} />
      </div>

      {order.trackingNumber ? (
        <div className="border-t border-ink/12 px-8 py-5">
          <p className="text-[12px] uppercase tracking-[0.08em] text-ink/55">
            Shipment
          </p>
          <p className="mt-2 text-[15px] text-ink">
            {order.courierName ? `${order.courierName} · ` : null}
            <span className="font-data">{order.trackingNumber}</span>
          </p>
          <p className="mt-1 text-[13px] text-ink/65">
            Use this AWB on the courier&apos;s website or app to follow the
            parcel.
          </p>
        </div>
      ) : null}

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
