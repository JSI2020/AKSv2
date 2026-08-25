"use client";

import { Money } from "@/modules/ui";
import { AksLogoImage } from "@/modules/shop/shell/brand";
import type { OrderDetail } from "../queries";

function formatDate(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(value);
}

type PrintChromeProps = {
  title: string;
  children: React.ReactNode;
};

function PrintChrome({ title, children }: PrintChromeProps) {
  return (
    <div className="mx-auto max-w-2xl bg-milk px-6 py-8 text-ink print:max-w-none print:px-0 print:py-0">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <p className="text-[13px] text-ink/55">{title}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="border border-ink bg-ink px-4 py-2 text-[12px] uppercase tracking-[0.1em] text-milk"
        >
          Print
        </button>
      </div>
      {children}
    </div>
  );
}

export function OrderInvoiceView({ order }: { order: OrderDetail }) {
  return (
    <PrintChrome title="Invoice">
      <header className="border-b border-ink/12 pb-4">
        <AksLogoImage size="header" />
        <p className="mt-2 font-data text-[13px]">{order.orderNumber}</p>
        <p className="mt-1 text-[13px] text-ink/55">
          Invoice · {formatDate(order.placedAt)}
        </p>
      </header>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Bill to
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed">
            {order.customer.name}
            <br />
            {order.customer.phone}
            {order.customer.email ? (
              <>
                <br />
                {order.customer.email}
              </>
            ) : null}
          </p>
        </div>
        <div>
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Ship to
          </h2>
          <p className="mt-2 text-[13px] leading-relaxed">
            {order.shippingAddressSnapshot.recipientName}
            <br />
            {order.shippingAddressSnapshot.addressLine1}
            <br />
            {order.shippingAddressSnapshot.city}
          </p>
        </div>
      </div>

      <table className="mt-8 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-ink/12 text-start font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            <th className="py-2 font-normal">Item</th>
            <th className="py-2 font-normal">Size</th>
            <th className="py-2 text-end font-normal">Qty</th>
            <th className="py-2 text-end font-normal">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-3">{item.designName}</td>
              <td className="py-3">
                {item.sizeMode === "MADE_TO_MEASURE"
                  ? "MTM"
                  : (item.sizeLabel ?? "—")}
              </td>
              <td className="py-3 text-end font-data">{item.quantity}</td>
              <td className="py-3 text-end">
                <Money value={item.lineTotalMinor} className="font-data" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="mt-6 ml-auto w-full max-w-xs space-y-2 text-[13px]">
        <div className="flex justify-between">
          <dt className="text-ink/55">Subtotal</dt>
          <dd>
            <Money value={order.subtotalMinor} className="font-data" />
          </dd>
        </div>
        {order.discountMinor > 0 ? (
          <div className="flex justify-between">
            <dt className="text-ink/55">Discount</dt>
            <dd>
              −<Money value={order.discountMinor} className="font-data" />
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt className="text-ink/55">Shipping</dt>
          <dd>
            <Money value={order.shippingMinor} className="font-data" />
          </dd>
        </div>
        <div className="flex justify-between border-t border-ink/12 pt-2 text-[14px]">
          <dt>Total</dt>
          <dd>
            <Money value={order.totalMinor} className="font-data" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/55">Paid</dt>
          <dd>
            <Money value={order.paidMinor} className="font-data" />
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-ink/55">Balance</dt>
          <dd>
            <Money value={order.balanceAmountMinor} className="font-data" />
          </dd>
        </div>
      </dl>
    </PrintChrome>
  );
}

export function OrderPackingSlipView({ order }: { order: OrderDetail }) {
  return (
    <PrintChrome title="Packing slip">
      <header className="border-b border-ink/12 pb-4">
        <AksLogoImage size="header" />
        <p className="mt-2 font-data text-[13px]">{order.orderNumber}</p>
        <p className="mt-1 text-[13px] text-ink/55">Packing slip</p>
      </header>

      <div className="mt-6">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Deliver to
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed">
          {order.shippingAddressSnapshot.recipientName}
          <br />
          {order.shippingAddressSnapshot.addressLine1}
          {order.shippingAddressSnapshot.addressLine2 ? (
            <>
              <br />
              {order.shippingAddressSnapshot.addressLine2}
            </>
          ) : null}
          <br />
          {order.shippingAddressSnapshot.city}
          {order.shippingAddressSnapshot.postalCode
            ? ` ${order.shippingAddressSnapshot.postalCode}`
            : ""}
          <br />
          {order.shippingAddressSnapshot.phone}
          {order.shippingAddressSnapshot.landmark ? (
            <>
              <br />
              Near {order.shippingAddressSnapshot.landmark}
            </>
          ) : null}
        </p>
      </div>

      <table className="mt-8 w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-ink/12 text-start font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
            <th className="py-2 font-normal">Item</th>
            <th className="py-2 font-normal">Size</th>
            <th className="py-2 text-end font-normal">Qty</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-ink/10">
              <td className="py-3">
                {item.designName}
                {item.sizeMode === "MADE_TO_MEASURE" ? (
                  <span className="ms-2 text-[11px] uppercase tracking-[0.08em] text-ink/55">
                    MTM
                  </span>
                ) : null}
              </td>
              <td className="py-3">{item.sizeLabel ?? "—"}</td>
              <td className="py-3 text-end font-data">{item.quantity}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {order.customerNotes ? (
        <div className="mt-8 border border-ink/12 p-4">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Note
          </h2>
          <p className="mt-2 text-[13px]">{order.customerNotes}</p>
        </div>
      ) : null}
    </PrintChrome>
  );
}
