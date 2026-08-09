"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { provinceLabel } from "@/modules/checkout/payment-plans";
import { useCan } from "@/modules/auth/use-can";
import { ConfirmDialog, Measure, Money } from "@/modules/ui";

import {
  adjustOrderPriceAction,
  advanceStageAction,
  cancelOrderAction,
  confirmMeasurementsAction,
  editOrderBeforeLockAction,
  recordPaymentAction,
  refundOrderAction,
  updateOrderNotesAction,
  uploadOrderPhotoAction,
} from "../actions";
import { OrderMessagesPanel } from "./order-messages-panel";
import {
  ORDER_CANCEL_REASONS,
  ORDER_PAYMENT_PROVIDERS,
  ORDER_PRICE_ADJUSTMENT_REASONS,
} from "../reason-codes";
import type { OrderDetail } from "../queries";
import {
  getNextProductionStage,
  isBeforeProductionLock,
  PAYMENT_STATUS_LABELS,
  PRODUCTION_STATUS_LABELS,
  productionStageLabel,
} from "../status";
import type { OrderStatus } from "../constants";

function formatDateTime(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

type OrderDetailViewProps = {
  order: OrderDetail;
  messages?: Array<{
    id: string;
    templateKey: string;
    recipient: string;
    status: string;
    sentAt: Date | null;
    error: string | null;
    createdAt: Date;
  }>;
};

export function OrderDetailView({ order, messages = [] }: OrderDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [customerRemark, setCustomerRemark] = useState("");

  const canAdvance = useCan("orders.advance_status");
  const canEdit = useCan("orders.edit");
  const canRefund = useCan("orders.refund");
  const canCancel = useCan("orders.cancel");

  const nextStage = getNextProductionStage(order.status, order.skipEmbroidery);
  const beforeLock = isBeforeProductionLock(order.status);

  function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        setMessage("Saved.");
        router.refresh();
      } else {
        setError(result.error ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-data text-[12px] text-chalk">{order.orderNumber}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusPill
              label={PRODUCTION_STATUS_LABELS[order.productionStatus]}
              tone="production"
            />
            <StatusPill
              label={PAYMENT_STATUS_LABELS[order.paymentStatus]}
              tone="payment"
            />
            {order.atRisk ? (
              <StatusPill label="At risk" tone="risk" />
            ) : null}
          </div>
        </div>
        <div className="text-end text-[12px] text-chalk">
          <p>Placed {formatDateTime(order.placedAt)}</p>
          <p>Promised {formatDateTime(order.promisedShipDate)}</p>
          <p className="mt-1 uppercase tracking-[0.08em]">{order.source}</p>
        </div>
      </div>

      {message ? (
        <p className="border border-zari/40 px-3 py-2 text-[13px] text-zari">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="border border-madder px-3 py-2 text-[13px] text-madder">
          {error}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex flex-col gap-6">
          <Section title="Customer">
            {order.customer.userId ? (
              <Link
                href={`/admin/customers/${order.customer.userId}`}
                className="text-[13px] text-zari hover:underline"
              >
                {order.customer.name}
              </Link>
            ) : (
              <p className="text-[13px] text-greige">{order.customer.name}</p>
            )}
            <dl className="mt-2 grid gap-1 text-[13px] text-chalk">
              <Row label="Phone" value={order.customer.phone} />
              <Row label="WhatsApp" value={order.customer.whatsappNumber} />
              {order.customer.email ? (
                <Row label="Email" value={order.customer.email} />
              ) : null}
            </dl>
          </Section>

          <Section title="Shipping address">
            <address className="not-italic text-[13px] leading-relaxed text-greige">
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
              {order.shippingAddressSnapshot.city},{" "}
              {provinceLabel(
                order.shippingAddressSnapshot.province as import("@aks/db").PakistanProvince,
              )}
              {order.shippingAddressSnapshot.postalCode
                ? ` ${order.shippingAddressSnapshot.postalCode}`
                : ""}
              {order.shippingAddressSnapshot.landmark ? (
                <>
                  <br />
                  Near {order.shippingAddressSnapshot.landmark}
                </>
              ) : null}
            </address>
          </Section>

          <Section title="Items">
            {order.items.map((item) => (
              <div
                key={item.id}
                className="border-b border-indigo-lift py-4 last:border-b-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[13px] text-greige">{item.designName}</p>
                    <p className="font-data text-[11px] text-chalk">
                      {item.sizeMode === "STANDARD"
                        ? `Standard · ${item.sizeLabel ?? "—"}`
                        : "Made to measure"}
                    </p>
                  </div>
                  <Money
                    value={item.lineTotalMinor}
                    className="text-[12px] text-greige"
                  />
                </div>

                {item.measurementSnapshot?.values ? (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full min-w-[20rem] border-collapse text-[12px]">
                      <thead>
                        <tr className="border-b border-indigo-lift text-chalk">
                          <th className="px-2 py-1 text-start font-normal">
                            Measurement
                          </th>
                          <th className="px-2 py-1 text-end font-normal">
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(item.measurementSnapshot.values).map(
                          ([key, value]) => (
                            <tr
                              key={key}
                              className="border-b border-indigo-lift/50"
                            >
                              <td className="px-2 py-1 text-greige">{key}</td>
                              <td className="px-2 py-1 text-end">
                                <Measure value={value} />
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {Object.keys(item.customizationSnapshot).length > 0 ? (
                  <dl className="mt-3 grid gap-1 text-[12px] text-chalk">
                    {Object.entries(item.customizationSnapshot).map(
                      ([key, value]) => (
                        <Row
                          key={key}
                          label={key}
                          value={String(value)}
                        />
                      ),
                    )}
                  </dl>
                ) : null}

                <dl className="mt-3 grid gap-1 text-[12px] text-chalk">
                  <Row
                    label="Base"
                    value={<Money value={item.priceBreakdownSnapshot.basePriceMinor} />}
                  />
                  {item.priceBreakdownSnapshot.colourwayDeltaMinor !== 0 ? (
                    <Row
                      label="Colourway"
                      value={
                        <Money
                          value={item.priceBreakdownSnapshot.colourwayDeltaMinor}
                        />
                      }
                    />
                  ) : null}
                  {item.priceBreakdownSnapshot.customizationDeltaMinor !== 0 ? (
                    <Row
                      label="Customizations"
                      value={
                        <Money
                          value={
                            item.priceBreakdownSnapshot.customizationDeltaMinor
                          }
                        />
                      }
                    />
                  ) : null}
                  {item.priceBreakdownSnapshot.madeToMeasureSurchargeMinor !==
                  0 ? (
                    <Row
                      label="Made to measure"
                      value={
                        <Money
                          value={
                            item.priceBreakdownSnapshot.madeToMeasureSurchargeMinor
                          }
                        />
                      }
                    />
                  ) : null}
                </dl>
              </div>
            ))}
          </Section>

          <Section title="Timeline">
            {order.events.length === 0 ? (
              <p className="text-[13px] text-chalk">No events yet.</p>
            ) : (
              <ol className="divide-y divide-indigo-lift">
                {order.events.map((event) => (
                  <li key={event.id} className="py-2.5">
                    <p className="font-data text-[12px] text-chalk">
                      {formatDateTime(event.createdAt)}
                    </p>
                    <p className="text-[13px] text-greige">
                      {event.fromStatus} → {event.toStatus}
                    </p>
                    {event.actorName ? (
                      <p className="text-[12px] text-chalk">{event.actorName}</p>
                    ) : null}
                    {event.note ? (
                      <p className="mt-1 text-[12px] text-chalk">{event.note}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section title="Photos">
            {order.photos.length === 0 ? (
              <p className="text-[13px] text-chalk">No photos yet.</p>
            ) : (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {order.photos.map((photo) => (
                  <li key={photo.id} className="border border-indigo-lift p-2">
                    {photo.readUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.readUrl}
                        alt={`${photo.stage} photo`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="flex aspect-square items-center justify-center bg-indigo-lift/30 text-[12px] text-chalk">
                        Unavailable
                      </div>
                    )}
                    <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-chalk">
                      {photo.stage}
                      {photo.isCustomerVisible ? " · customer visible" : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <aside className="flex flex-col gap-4">
          <Section title="Payment">
            <dl className="grid gap-1 text-[13px]">
              <Row label="Plan" value={order.paymentPlan.replaceAll("_", " ")} />
              <Row
                label="Total"
                value={<Money value={order.totalMinor} className="text-greige" />}
              />
              <Row
                label="Deposit due"
                value={
                  <Money
                    value={order.depositAmountMinor}
                    className="text-greige"
                  />
                }
              />
              <Row
                label="Balance due"
                value={
                  <Money
                    value={order.balanceAmountMinor}
                    className="text-greige"
                  />
                }
              />
              <Row
                label="Recorded"
                value={
                  <Money value={order.paidMinor} className="text-greige" />
                }
              />
            </dl>
            {order.payments.length > 0 ? (
              <ul className="mt-3 divide-y divide-indigo-lift text-[12px] text-chalk">
                {order.payments.map((p) => (
                  <li key={p.id} className="py-1.5">
                    <Money value={p.amountMinor} /> · {p.kind} · {p.provider}
                  </li>
                ))}
              </ul>
            ) : null}
          </Section>

          <Section title="Production">
            <p className="text-[13px] text-greige">
              {productionStageLabel(order.status)}
            </p>
          </Section>

          <Section title="Customer-visible notes">
            <NotesForm
              initial={order.customerNotes ?? ""}
              disabled={!canEdit || pending}
              onSave={(value) =>
                run(() =>
                  updateOrderNotesAction({
                    orderId: order.id,
                    customerNotes: value,
                  }),
                )
              }
            />
          </Section>

          <Section title="Internal notes">
            <p className="mb-2 font-sans text-[11px] uppercase tracking-[0.08em] text-chalk">
              Never shown to the customer
            </p>
            <NotesForm
              initial={order.internalNotes ?? ""}
              disabled={!canEdit || pending}
              onSave={(value) =>
                run(() =>
                  updateOrderNotesAction({
                    orderId: order.id,
                    internalNotes: value,
                  }),
                )
              }
            />
          </Section>

          <Section title="Customer emails">
            <OrderMessagesPanel messages={messages} />
          </Section>

          <Section title="Actions">
            <div className="flex flex-col gap-2">
              {canAdvance && order.status === "DEPOSIT_PAID" ? (
                <ActionButton
                  disabled={pending}
                  onClick={() =>
                    run(() => confirmMeasurementsAction(order.id))
                  }
                >
                  Confirm measurements
                </ActionButton>
              ) : null}

              {canAdvance && nextStage ? (
                <div className="flex flex-col gap-2 border border-indigo-lift p-2">
                  <ActionButton
                    disabled={pending}
                    onClick={() =>
                      run(() =>
                        advanceStageAction({
                          orderId: order.id,
                          customerRemark: customerRemark || undefined,
                        }),
                      )
                    }
                  >
                    Advance to {productionStageLabel(nextStage as OrderStatus)}
                  </ActionButton>
                  <label className="text-[12px] text-chalk">
                    Note for customer (optional)
                    <textarea
                      value={customerRemark}
                      onChange={(e) => setCustomerRemark(e.target.value)}
                      rows={2}
                      disabled={pending}
                      placeholder="Included in the status email — never internal notes"
                      className="mt-1 w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
                    />
                  </label>
                </div>
              ) : null}

              {canEdit ? (
                <RecordPaymentForm
                  order={order}
                  disabled={pending}
                  onSubmit={(data) =>
                    run(() => recordPaymentAction({ orderId: order.id, ...data }))
                  }
                />
              ) : null}

              {canRefund ? (
                <ActionButton
                  disabled={pending}
                  onClick={() => run(() => refundOrderAction(order.id))}
                >
                  {order.status === "REFUND_PENDING"
                    ? "Complete refund"
                    : "Refund"}
                </ActionButton>
              ) : null}

              {canCancel ? (
                <CancelOrderForm
                  order={order}
                  disabled={pending}
                  onSubmit={(data) =>
                    run(() =>
                      cancelOrderAction({ orderId: order.id, ...data }),
                    )
                  }
                />
              ) : null}

              {canEdit && beforeLock ? (
                <EditBeforeLockForm
                  order={order}
                  disabled={pending}
                  onSubmit={(data) =>
                    run(() =>
                      editOrderBeforeLockAction({ orderId: order.id, ...data }),
                    )
                  }
                />
              ) : null}

              {canEdit ? (
                <AdjustPriceForm
                  order={order}
                  disabled={pending}
                  onSubmit={(data) =>
                    run(() =>
                      adjustOrderPriceAction({ orderId: order.id, ...data }),
                    )
                  }
                />
              ) : null}

              {canEdit ? (
                <PhotoUploadForm
                  order={order}
                  disabled={pending}
                  onUploaded={() => router.refresh()}
                />
              ) : null}
            </div>
          </Section>
        </aside>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-indigo-lift p-3">
      <h2 className="mb-3 font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-chalk">{label}</dt>
      <dd className="text-greige">{value}</dd>
    </div>
  );
}

function StatusPill({
  label,
  tone,
}: {
  label: string;
  tone: "production" | "payment" | "risk";
}) {
  const classes =
    tone === "risk"
      ? "border-madder text-madder"
      : tone === "payment"
        ? "border-chalk/40 text-chalk"
        : "border-zari/50 text-zari";
  return (
    <span
      className={`inline-block border px-2 py-0.5 font-sans text-[11px] uppercase tracking-[0.08em] ${classes}`}
    >
      {label}
    </span>
  );
}

function ActionButton({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="border border-zari px-3 py-1.5 text-[13px] text-zari disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function NotesForm({
  initial,
  disabled,
  onSave,
}: {
  initial: string;
  disabled?: boolean;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={3}
        disabled={disabled}
        className="w-full border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(value)}
        className="self-start border border-indigo-lift px-2 py-1 text-[12px] text-chalk disabled:opacity-40"
      >
        Save notes
      </button>
    </div>
  );
}

function RecordPaymentForm({
  order,
  disabled,
  onSubmit,
}: {
  order: OrderDetail;
  disabled?: boolean;
  onSubmit: (data: {
    amountMinor: number;
    provider: string;
    kind: "DEPOSIT" | "BALANCE" | "FULL";
    note?: string;
  }) => void;
}) {
  const [amount, setAmount] = useState("");
  const [provider, setProvider] = useState("BANK_TRANSFER");
  const defaultKind =
    order.status === "AWAITING_DEPOSIT"
      ? "DEPOSIT"
      : order.balanceAmountMinor > 0
        ? "BALANCE"
        : "FULL";
  const [kind, setKind] = useState<"DEPOSIT" | "BALANCE" | "FULL">(defaultKind);

  return (
    <div className="border border-indigo-lift p-2">
      <p className="mb-2 text-[12px] text-chalk">Record payment</p>
      <div className="flex flex-col gap-2">
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Amount (PKR)"
          disabled={disabled}
          className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
        />
        <select
          value={kind}
          onChange={(e) =>
            setKind(e.target.value as "DEPOSIT" | "BALANCE" | "FULL")
          }
          disabled={disabled}
          className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
        >
          <option value="DEPOSIT">Deposit</option>
          <option value="BALANCE">Balance</option>
          <option value="FULL">Full</option>
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          disabled={disabled}
          className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
        >
          {ORDER_PAYMENT_PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={disabled || !amount}
          onClick={() =>
            onSubmit({
              amountMinor: Math.round(Number(amount) * 100),
              provider,
              kind,
            })
          }
          className="border border-zari px-2 py-1 text-[12px] text-zari disabled:opacity-40"
        >
          Record payment
        </button>
      </div>
    </div>
  );
}

function CancelOrderForm({
  order,
  disabled,
  onSubmit,
}: {
  order: OrderDetail;
  disabled?: boolean;
  onSubmit: (data: {
    reasonCode: string;
    note?: string;
    acknowledgeDepositForfeit?: boolean;
  }) => void;
}) {
  const [reasonCode, setReasonCode] = useState<string>(
    ORDER_CANCEL_REASONS[0]?.code ?? "OTHER",
  );
  const [note, setNote] = useState("");
  const [ack, setAck] = useState(false);
  const needsAck =
    order.status === "MEASUREMENTS_CONFIRMED" ||
    order.status === "CUTTING" ||
    order.status === "STITCHING" ||
    order.status === "EMBROIDERY" ||
    order.status === "FINISHING" ||
    order.status === "IN_PRODUCTION" ||
    order.status === "QUALITY_CHECK" ||
    order.status === "READY_TO_SHIP" ||
    order.status === "DISPATCHED" ||
    order.status === "DELIVERED";

  return (
    <div className="border border-madder/40 p-2">
      <p className="mb-2 text-[12px] text-madder">Cancel order</p>
      <div className="flex flex-col gap-2">
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          disabled={disabled}
          className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
        >
          {ORDER_CANCEL_REASONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.label}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Additional note"
          disabled={disabled}
          className="border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
        />
        {needsAck ? (
          <label className="flex items-start gap-2 text-[12px] text-chalk">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
              disabled={disabled}
            />
            Deposit is non-refundable after measurements are confirmed.
          </label>
        ) : null}
        <ConfirmDialog
          title="Cancel this order?"
          description="This cannot be undone without a new order."
          confirmLabel="Cancel order"
          trigger={
            <button
              type="button"
              disabled={disabled || (needsAck && !ack)}
              className="border border-madder px-2 py-1 text-[12px] text-madder disabled:opacity-40"
            >
              Cancel order
            </button>
          }
          onConfirm={async () =>
            onSubmit({
              reasonCode,
              note: note || undefined,
              acknowledgeDepositForfeit: needsAck ? ack : undefined,
            })
          }
        />
      </div>
    </div>
  );
}

function EditBeforeLockForm({
  order,
  disabled,
  onSubmit,
}: {
  order: OrderDetail;
  disabled?: boolean;
  onSubmit: (data: {
    whatsappNumber?: string;
    customerNotes?: string;
    internalNotes?: string;
  }) => void;
}) {
  const [whatsapp, setWhatsapp] = useState(order.customer.whatsappNumber);
  return (
    <div className="border border-indigo-lift p-2">
      <p className="mb-2 text-[12px] text-chalk">Edit before production lock</p>
      <input
        type="tel"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit({ whatsappNumber: whatsapp })}
        className="border border-indigo-lift px-2 py-1 text-[12px] text-chalk"
      >
        Save contact
      </button>
    </div>
  );
}

function AdjustPriceForm({
  order,
  disabled,
  onSubmit,
}: {
  order: OrderDetail;
  disabled?: boolean;
  onSubmit: (data: {
    newTotalMinor: number;
    reasonCode: string;
    note?: string;
  }) => void;
}) {
  const [total, setTotal] = useState(String(order.totalMinor / 100));
  const [reasonCode, setReasonCode] = useState<string>(
    ORDER_PRICE_ADJUSTMENT_REASONS[0]?.code ?? "OTHER",
  );
  const [note, setNote] = useState("");

  return (
    <div className="border border-indigo-lift p-2">
      <p className="mb-2 text-[12px] text-chalk">Adjust price</p>
      <input
        type="number"
        min={1}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
      />
      <select
        value={reasonCode}
        onChange={(e) => setReasonCode(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
      >
        {ORDER_PRICE_ADJUSTMENT_REASONS.map((r) => (
          <option key={r.code} value={r.code}>
            {r.label}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Reason note"
        disabled={disabled}
        className="mb-2 w-full border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
      />
      <button
        type="button"
        disabled={disabled || !total}
        onClick={() =>
          onSubmit({
            newTotalMinor: Math.round(Number(total) * 100),
            reasonCode,
            note: note || undefined,
          })
        }
        className="border border-zari px-2 py-1 text-[12px] text-zari disabled:opacity-40"
      >
        Adjust price
      </button>
    </div>
  );
}

function PhotoUploadForm({
  order,
  disabled,
  onUploaded,
}: {
  order: OrderDetail;
  disabled?: boolean;
  onUploaded: () => void;
}) {
  const [stage, setStage] = useState(productionStageLabel(order.status));
  const [visible, setVisible] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presignRes.ok) throw new Error("Could not prepare upload.");
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };

      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed.");

      const result = await uploadOrderPhotoAction({
        orderId: order.id,
        key,
        mime: file.type,
        stage,
        isCustomerVisible: visible,
      });
      if (!result.ok) throw new Error(result.error);
      onUploaded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border border-indigo-lift p-2">
      <p className="mb-2 text-[12px] text-chalk">Upload photo</p>
      <input
        type="text"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        disabled={disabled || uploading}
        className="mb-2 w-full border border-indigo-lift bg-indigo px-2 py-1 text-[13px] text-greige"
      />
      <label className="mb-2 flex items-center gap-2 text-[12px] text-chalk">
        <input
          type="checkbox"
          checked={visible}
          onChange={(e) => setVisible(e.target.checked)}
          disabled={disabled || uploading}
        />
        Customer can see this photo
      </label>
      <input
        type="file"
        accept="image/*"
        disabled={disabled || uploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
        className="text-[12px] text-chalk"
      />
      {error ? <p className="mt-1 text-[12px] text-madder">{error}</p> : null}
    </div>
  );
}
