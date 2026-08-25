"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { provinceLabel } from "@/modules/checkout/payment-plans";
import { useCan } from "@/modules/auth/use-can";
import { ConfirmDialog, Measure, Money } from "@/modules/ui";
import { ORDER_STATUS_TEMPLATE_KEYS } from "@/modules/messaging/template-keys";
import { cn } from "@/lib/utils";

import {
  adjustOrderPriceAction,
  advanceStageAction,
  cancelOrderAction,
  confirmMeasurementsAction,
  editOrderBeforeLockAction,
  recordPaymentAction,
  refundOrderAction,
  updateDepositAction,
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
  buildAdminProductionPipeline,
  buildStagePick,
  gateNoteForStage,
  getNextProductionStage,
  isBeforeProductionLock,
  isTerminalOrderStatus,
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

export function OrderDetailView({
  order,
  messages = [],
}: OrderDetailViewProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [customerRemark, setCustomerRemark] = useState("");
  const [advancePhoto, setAdvancePhoto] = useState<File | null>(null);

  const canAdvance = useCan("orders.advance_status");
  const canEdit = useCan("orders.edit");
  const canRefund = useCan("orders.refund");
  const canCancel = useCan("orders.cancel");
  const nextStage = getNextProductionStage(order.status, order.skipEmbroidery);
  const beforeLock = isBeforeProductionLock(order.status);
  const stagePick = buildStagePick(order.status, order.skipEmbroidery);
  const gateNote = gateNoteForStage(order.status, order.skipEmbroidery);
  const pipeline = buildAdminProductionPipeline(order.status);
  const canShowAdvance =
    canAdvance &&
    !isTerminalOrderStatus(order.status) &&
    (order.status === "AWAITING_DEPOSIT" ||
      order.status === "DEPOSIT_PAID" ||
      Boolean(nextStage));
  const depositPaid =
    order.paidMinor >= order.depositAmountMinor && order.depositAmountMinor > 0;

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

  async function uploadAdvancePhoto(file: File) {
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
      stage: productionStageLabel(order.status),
      isCustomerVisible: false,
    });
    if (!result.ok) throw new Error(result.error);
  }

  function advance() {
    run(async () => {
      try {
        if (advancePhoto) await uploadAdvancePhoto(advancePhoto);
        if (order.status === "AWAITING_DEPOSIT") {
          return await updateDepositAction({
            orderId: order.id,
            depositAmountMinor: order.depositAmountMinor,
            markDepositPaid: true,
          });
        }
        if (order.status === "DEPOSIT_PAID") {
          return await confirmMeasurementsAction(order.id);
        }
        return await advanceStageAction({
          orderId: order.id,
          customerRemark: customerRemark || undefined,
        });
      } catch (caught) {
        return {
          ok: false,
          error:
            caught instanceof Error
              ? caught.message
              : "Could not advance order.",
        };
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <Link
        href="/admin/orders"
        className="self-start text-[13px] text-ink/55 hover:text-ink"
      >
        ← All orders
      </Link>

      <header className="pipeline-rail flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <p className="font-data text-[1.1rem] tracking-[0.02em] text-milk">
            {order.orderNumber}
          </p>
          <p className="mt-1 text-[13px] text-milk/70">
            {order.customer.name} · placed {formatPlaced(order.placedAt)} ·{" "}
            {order.source.replaceAll("_", " ").toLowerCase()} order
          </p>
        </div>
        <div className="flex gap-4">
          <div className="text-center">
            <p className="mb-1.5 font-sans text-[9px] uppercase tracking-[0.18em] text-milk/55">
              Production
            </p>
            <span className="inline-block border border-[#A8C29A] px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-[#A8C29A]">
              {PRODUCTION_STATUS_LABELS[order.productionStatus]}
            </span>
          </div>
          <div className="text-center">
            <p className="mb-1.5 font-sans text-[9px] uppercase tracking-[0.18em] text-milk/55">
              Payment
            </p>
            <span className="inline-block border border-zari px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-zari">
              {PAYMENT_STATUS_LABELS[order.paymentStatus]}
            </span>
          </div>
        </div>
      </header>

      <section className="border border-ink/12 bg-greige px-4 py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.18em] text-ink/55">
            Production pipeline
          </h2>
          <p className="text-[11px] text-ink/50">
            Each advance queues WhatsApp + email to the customer
          </p>
        </div>
        <ol className="flex gap-0 overflow-x-auto pb-1">
          {pipeline.map((step, index) => (
            <li
              key={step.key}
              className="flex min-w-[5.5rem] flex-1 flex-col items-center gap-2"
            >
              <div className="flex w-full items-center">
                {index > 0 ? (
                  <span
                    className={cn(
                      "h-px flex-1",
                      step.state === "upcoming" ? "bg-ink/15" : "bg-chalk",
                    )}
                  />
                ) : (
                  <span className="flex-1" />
                )}
                <span
                  className={cn(
                    "size-3 shrink-0 rounded-full border-2",
                    step.state === "done" && "border-chalk bg-chalk",
                    step.state === "current" &&
                      "border-madder bg-greige shadow-[0_0_0_4px_rgba(140,47,57,0.12)]",
                    step.state === "upcoming" && "border-ink/20 bg-greige",
                  )}
                />
                {index < pipeline.length - 1 ? (
                  <span
                    className={cn(
                      "h-px flex-1",
                      step.state === "done" ? "bg-chalk" : "bg-ink/15",
                    )}
                  />
                ) : (
                  <span className="flex-1" />
                )}
              </div>
              <span
                className={cn(
                  "px-1 text-center text-[11px] leading-tight",
                  step.state === "current" && "font-medium text-ink",
                  step.state === "done" && "text-ink/70",
                  step.state === "upcoming" && "text-ink/40",
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {message ? (
        <p className="border border-zari/50 px-3 py-2 text-[13px] text-zari">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="border border-madder px-3 py-2 text-[13px] text-madder">
          {error}
        </p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <main className="flex flex-col gap-5">
          <Panel title="Items">
            <div className="divide-y divide-ink/12">
              {order.items.map((item) => {
                const meta = Object.entries(item.customizationSnapshot)
                  .map(([, v]) => String(v))
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <article key={item.id} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                    <div className="h-[70px] w-[54px] shrink-0 border border-ink/12 bg-greige">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-[1.2rem] font-light text-ink">
                        <Link
                          href={`/admin/designs/${item.designId}`}
                          className="hover:underline"
                        >
                          {item.designName}
                        </Link>
                        {item.sizeMode === "MADE_TO_MEASURE" ? (
                          <span className="ms-2 inline-block bg-ink px-2 py-0.5 align-middle font-sans text-[9px] uppercase tracking-[0.1em] text-milk">
                            Made to measure
                          </span>
                        ) : null}
                      </p>
                      {meta ? (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-ink/55">
                          {meta}
                        </p>
                      ) : item.sizeLabel ? (
                        <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-ink/55">
                          Size {item.sizeLabel}
                        </p>
                      ) : null}
                      {item.measurementSnapshot?.values ? (
                        <table className="mt-2 w-full border-collapse text-[12px]">
                          <tbody>
                            {Object.entries(
                              item.measurementSnapshot.values,
                            ).map(([key, value]) => (
                              <tr key={key} className="border-b border-ink/10">
                                <td className="px-1 py-1 text-ink/55">{key}</td>
                                <td className="px-1 py-1 text-end font-data">
                                  <Measure value={value} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : null}
                      <p className="mt-3 text-[11px] tracking-[0.04em] text-chalk">
                        ↑ Frozen measurement snapshot — the cut spec the tailor
                        works to.
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>

          {canShowAdvance ? (
            <section className="pipeline-rail px-5 py-5">
              <h3 className="mb-4 font-sans text-[10px] uppercase tracking-[0.18em] text-milk/60">
                Advance stage
              </h3>
              <div className="mb-3 flex flex-wrap gap-2">
                {stagePick.map((stage) => (
                  <button
                    key={stage.status}
                    type="button"
                    disabled={
                      stage.kind !== "next" || pending || !canAdvance
                    }
                    onClick={() => {
                      if (stage.kind === "next") void advance();
                    }}
                    className={cn(
                      "border px-3 py-2 text-[12px] transition-colors",
                      stage.kind === "current" &&
                        "border-zari bg-zari/20 text-milk",
                      stage.kind === "next" &&
                        "border-milk/25 text-milk/85 hover:border-zari",
                      stage.kind === "past" && "border-milk/20 text-milk/85",
                      stage.kind === "locked" &&
                        "cursor-not-allowed border-milk/15 text-milk/35",
                    )}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
              <p className="mb-3 text-[12px] text-milk/70">
                Add a note the customer sees, or an internal one, and attach a
                photo — WhatsApp + email queue automatically on advance.
              </p>
              {gateNote ? (
                <p className="mb-3 text-[12px] text-zari">{gateNote}</p>
              ) : null}
              <div className="grid gap-3">
                <textarea
                  value={customerRemark}
                  onChange={(event) => setCustomerRemark(event.target.value)}
                  rows={2}
                  disabled={pending}
                  placeholder="Note for the customer (optional)"
                  className="w-full border border-milk/20 bg-transparent px-3 py-2 text-[13px] text-milk placeholder:text-milk/40"
                />
                <input
                  type="file"
                  accept="image/*"
                  disabled={pending}
                  onChange={(event) =>
                    setAdvancePhoto(event.target.files?.[0] ?? null)
                  }
                  className="text-[12px] text-milk/70"
                />
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => void advance()}
                  className="self-start border border-zari bg-zari/20 px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-40"
                >
                  {order.status === "AWAITING_DEPOSIT"
                    ? "Mark deposit paid → Order confirmed"
                    : order.status === "DEPOSIT_PAID"
                      ? "Confirm → start cutting"
                      : nextStage
                        ? `Advance to ${productionStageLabel(nextStage)}`
                        : "Advance"}
                </button>
              </div>
            </section>
          ) : null}

          <Panel title="Timeline">
            {(() => {
              type Entry =
                | {
                    kind: "status";
                    id: string;
                    at: Date;
                    toStatus: string;
                    note: string | null;
                  }
                | {
                    kind: "payment";
                    id: string;
                    at: Date;
                    label: string;
                    note: string | null;
                    amountMinor: number;
                  };
              const entries: Entry[] = [
                ...order.events.map((event) => ({
                  kind: "status" as const,
                  id: event.id,
                  at: event.createdAt,
                  toStatus: event.toStatus,
                  note: event.note,
                })),
                ...order.payments
                  .filter((p) => p.status === "SUCCEEDED")
                  .map((p) => ({
                    kind: "payment" as const,
                    id: `pay-${p.id}`,
                    at: p.createdAt,
                    label:
                      p.kind === "DEPOSIT"
                        ? `Deposit paid — ${
                            order.totalMinor > 0
                              ? Math.round(
                                  (p.amountMinor / order.totalMinor) * 100,
                                )
                              : 0
                          }%`
                        : p.kind === "BALANCE"
                          ? "Balance paid"
                          : p.kind === "FULL"
                            ? "Paid in full"
                            : `Payment · ${p.kind}`,
                    note: p.note,
                    amountMinor: p.amountMinor,
                  })),
              ].sort((a, b) => b.at.getTime() - a.at.getTime());

              if (!entries.length) {
                return (
                  <p className="text-[13px] text-ink/55">No events yet.</p>
                );
              }

              return (
                <ol>
                  {entries.map((entry) => {
                    if (entry.kind === "payment") {
                      return (
                        <li
                          key={entry.id}
                          className="flex gap-4 border-b border-ink/10 py-2.5 last:border-b-0"
                        >
                          <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-zari" />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap justify-between gap-2">
                              <span className="text-[13px] text-ink">
                                {entry.label}
                              </span>
                              <span className="font-data text-[10.5px] text-ink/55">
                                {formatDateTime(entry.at)}
                              </span>
                            </div>
                            <p className="mt-0.5 font-data text-[12.5px] text-ink/55">
                              <Money value={entry.amountMinor} />
                              {entry.note ? ` · ${entry.note}` : ""}
                            </p>
                          </div>
                        </li>
                      );
                    }

                    const templateKey =
                      ORDER_STATUS_TEMPLATE_KEYS[entry.toStatus];
                    const emailed = templateKey
                      ? messages.some(
                          (email) =>
                            email.templateKey === templateKey && email.sentAt,
                        )
                      : false;
                    return (
                      <li
                        key={entry.id}
                        className="flex gap-4 border-b border-ink/10 py-2.5 last:border-b-0"
                      >
                        <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-chalk" />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap justify-between gap-2">
                            <span className="text-[13px] text-ink">
                              {productionStageLabel(
                                entry.toStatus as OrderStatus,
                              )}
                            </span>
                            <span className="font-data text-[10.5px] text-ink/55">
                              {formatDateTime(entry.at)}
                            </span>
                          </div>
                          {entry.note ? (
                            <p className="mt-0.5 text-[12.5px] text-ink/55">
                              {entry.note}
                            </p>
                          ) : null}
                          {emailed ? (
                            <p className="mt-1 text-[10px] uppercase tracking-[0.06em] text-chalk">
                              ✓ Emailed
                            </p>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              );
            })()}
          </Panel>

          {order.photos.length ? (
            <Panel title="Photos">
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {order.photos.map((photo) => (
                  <li key={photo.id} className="border border-ink/12 p-2">
                    {photo.readUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.readUrl}
                        alt={`${photo.stage} photo`}
                        className="aspect-square w-full object-cover"
                      />
                    ) : (
                      <div className="aspect-square bg-milk" />
                    )}
                    <p className="mt-1 text-[11px] text-chalk">{photo.stage}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          ) : null}
        </main>

        <aside className="flex flex-col gap-4">
          <Panel title="Customer">
            {order.customer.userId ? (
              <Link
                href={`/admin/customers/${order.customer.userId}`}
                className="font-display text-[1.25rem] font-light text-ink hover:underline"
              >
                {order.customer.name}
              </Link>
            ) : (
              <Link
                href={`/admin/customers/guest/${encodeURIComponent(order.customer.whatsappNumber)}`}
                className="font-display text-[1.25rem] font-light text-ink hover:underline"
              >
                {order.customer.name}
              </Link>
            )}
            <dl className="mt-3 grid gap-2 text-[13px]">
              <Kv
                label="Email"
                value={
                  <span className="font-data text-[12px]">
                    {order.customer.email ?? "—"}
                  </span>
                }
              />
              <Kv
                label="Phone"
                value={
                  <span className="font-data text-[12px]">
                    {order.customer.phone || "—"}
                  </span>
                }
              />
              <Kv
                label="WhatsApp"
                value={
                  <span className="font-data text-[12px]">
                    {order.customer.whatsappNumber || "—"}
                  </span>
                }
              />
              <Kv
                label="Orders"
                value={ordinal(order.customerOrderOrdinal)}
              />
              <Kv
                label="Account"
                value={order.customer.userId ? "Registered" : "Guest"}
              />
            </dl>
            <Link
              href={
                order.customer.userId
                  ? `/admin/customers/${order.customer.userId}`
                  : `/admin/customers/guest/${encodeURIComponent(order.customer.whatsappNumber)}`
              }
              className="mt-3 inline-block text-[12px] text-madder hover:underline"
            >
              View all orders →
            </Link>
          </Panel>
          <Panel title="Deliver to">
            <address className="text-[13px] not-italic leading-relaxed text-ink">
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
                order.shippingAddressSnapshot
                  .province as import("@aks/db").PakistanProvince,
              )}
              {order.shippingAddressSnapshot.postalCode ? (
                <>
                  <br />
                  {order.shippingAddressSnapshot.postalCode}
                </>
              ) : null}
              {order.shippingAddressSnapshot.landmark ? (
                <>
                  <br />
                  <span className="text-ink/55">
                    {order.shippingAddressSnapshot.landmark}
                  </span>
                </>
              ) : null}
              <br />
              <span className="font-data text-[12px] text-ink/70">
                {order.shippingAddressSnapshot.phone}
              </span>
            </address>
          </Panel>
          <PaymentPanel
            order={order}
            depositPaid={depositPaid}
            canEdit={canEdit}
            pending={pending}
            onSave={(depositAmountMinor, markDepositPaid) =>
              run(() =>
                updateDepositAction({
                  orderId: order.id,
                  depositAmountMinor,
                  markDepositPaid,
                }),
              )
            }
          />
          <Panel title="Print">
            <div className="flex flex-col gap-2">
              {order.primaryProductionJobId ? (
                <Link
                  href={`/admin/production/${order.primaryProductionJobId}/spec`}
                  className="border border-ink/12 px-3 py-2 text-start text-[12px] text-ink hover:border-ink"
                >
                  ◦ Tailor spec sheet
                </Link>
              ) : (
                <span className="border border-ink/12 px-3 py-2 text-[12px] text-ink/40">
                  ◦ Tailor spec sheet (after measurements)
                </span>
              )}
              <Link
                href={`/admin/orders/${order.id}/invoice`}
                className="border border-ink/12 px-3 py-2 text-start text-[12px] text-ink hover:border-ink"
              >
                ◦ Invoice
              </Link>
              <Link
                href={`/admin/orders/${order.id}/packing-slip`}
                className="border border-ink/12 px-3 py-2 text-start text-[12px] text-ink hover:border-ink"
              >
                ◦ Packing slip
              </Link>
            </div>
          </Panel>

          <Panel title="Notes">
            <div className="flex flex-col gap-4">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-ink/55">
                  Customer-visible
                </p>
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
              </div>
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-[0.12em] text-ink/55">
                  Internal
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
              </div>
            </div>
          </Panel>

          {canEdit ? (
            <Panel title="Record payment">
              <RecordPaymentForm
                order={order}
                disabled={pending}
                onSubmit={(data) =>
                  run(() =>
                    recordPaymentAction({ orderId: order.id, ...data }),
                  )
                }
              />
            </Panel>
          ) : null}

          <Panel title="Messages">
            <OrderMessagesPanel messages={messages} />
          </Panel>

          {(canRefund || canCancel || (canEdit && beforeLock) || canEdit) ? (
            <Panel title="Order controls">
              <div className="flex flex-col gap-4">
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
                        editOrderBeforeLockAction({
                          orderId: order.id,
                          ...data,
                        }),
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
                        adjustOrderPriceAction({
                          orderId: order.id,
                          ...data,
                        }),
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
            </Panel>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function formatPlaced(value: Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(
    value,
  );
}

function ordinal(value: number | null): string {
  if (!value) return "1st order";
  const suffix =
    value % 100 >= 11 && value % 100 <= 13
      ? "th"
      : ({ 1: "st", 2: "nd", 3: "rd" }[value % 10] ?? "th");
  return `${value}${suffix} order`;
}

function PaymentPanel({
  order,
  depositPaid,
  canEdit,
  pending,
  onSave,
}: {
  order: OrderDetail;
  depositPaid: boolean;
  canEdit: boolean;
  pending: boolean;
  onSave: (depositAmountMinor: number, markDepositPaid: boolean) => void;
}) {
  const [depositRupees, setDepositRupees] = useState(
    (order.depositAmountMinor / 100).toFixed(2),
  );
  const [markPaid, setMarkPaid] = useState(depositPaid);
  const depositDraftMinor = Math.max(
    0,
    Math.round((Number.parseFloat(depositRupees) || 0) * 100),
  );
  const pct =
    order.totalMinor > 0
      ? Math.round((depositDraftMinor / order.totalMinor) * 100)
      : 0;
  // Balance due = total − paid. Preview treats “mark paid” as settling the draft deposit.
  const previewPaid = Math.max(
    order.paidMinor,
    markPaid || depositPaid ? depositDraftMinor : 0,
  );
  const balanceDue = Math.max(0, order.totalMinor - previewPaid);

  return (
    <Panel title="Payment">
      <dl className="grid gap-2 text-[13px]">
        <Kv
          label="Total"
          value={
            <Money value={order.totalMinor} className="font-data text-[12px]" />
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 py-1">
          <dt className="text-chalk">
            Deposit{order.totalMinor > 0 ? ` (${pct}%)` : ""}
          </dt>
          <dd className="flex items-center gap-2">
            {canEdit ? (
              <span className="flex items-center border border-ink/15 bg-milk">
                <span className="px-2 text-[11px] text-ink/50">PKR</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={depositRupees}
                  disabled={pending}
                  onChange={(e) => setDepositRupees(e.target.value)}
                  className="w-28 bg-transparent px-2 py-1.5 font-data text-[12px] text-ink outline-none"
                />
              </span>
            ) : (
              <Money
                value={order.depositAmountMinor}
                className="font-data text-[12px]"
              />
            )}
            {depositPaid || markPaid ? (
              <span className="text-[12px] text-ink">✓</span>
            ) : null}
          </dd>
        </div>
        <Kv
          label="Paid so far"
          value={
            <Money value={order.paidMinor} className="font-data text-[12px]" />
          }
        />
        <Kv
          label="Balance"
          value={
            <Money
              value={balanceDue}
              className={cn(
                "font-data text-[12px]",
                balanceDue > 0 && "text-madder",
              )}
            />
          }
        />
      </dl>
      {canEdit ? (
        <div className="mt-4 flex flex-col gap-3 border-t border-ink/10 pt-3">
          <label className="flex items-center gap-2 text-[12px] text-ink">
            <input
              type="checkbox"
              checked={markPaid}
              disabled={pending || depositPaid}
              onChange={(e) => setMarkPaid(e.target.checked)}
              className="size-3.5 accent-ink"
            />
            {depositPaid ? "Deposit paid" : "Mark deposit as paid"}
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!Number.isFinite(depositDraftMinor) || depositDraftMinor < 0)
                return;
              onSave(depositDraftMinor, markPaid && !depositPaid);
            }}
            className="self-start bg-ink px-4 py-2 text-[11px] uppercase tracking-[0.1em] text-milk disabled:opacity-40 hover:bg-madder"
          >
            Save payment status
          </button>
        </div>
      ) : null}
    </Panel>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-ink/12 bg-greige p-3">
      <h2 className="mb-3 text-[12px] uppercase tracking-[0.12em] text-chalk">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Kv({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-2">
      <dt className="text-chalk">{label}</dt>
      <dd className="text-ink">{value}</dd>
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
        ? "border-zari/50 text-zari"
        : "border-zari text-zari";
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
        className="w-full border border-ink/12 bg-greige px-2 py-1.5 text-[13px] text-ink"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSave(value)}
        className="self-start border border-ink/12 px-2 py-1 text-[12px] text-chalk disabled:opacity-40"
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
    <div className="flex flex-col gap-2">
      <input
        type="number"
        min={1}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount (PKR)"
        disabled={disabled}
        className="border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
      />
      <select
        value={kind}
        onChange={(e) =>
          setKind(e.target.value as "DEPOSIT" | "BALANCE" | "FULL")
        }
        disabled={disabled}
        className="border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
      >
        <option value="DEPOSIT">Deposit</option>
        <option value="BALANCE">Balance</option>
        <option value="FULL">Full</option>
      </select>
      <select
        value={provider}
        onChange={(e) => setProvider(e.target.value)}
        disabled={disabled}
        className="border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
        className="bg-zari/20 px-3 py-2 text-[12px] uppercase tracking-[0.08em] text-ink disabled:opacity-40"
      >
        Record payment
      </button>
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
          className="border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
          className="border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
    <div className="border border-ink/12 p-2">
      <p className="mb-2 text-[12px] text-chalk">Edit before production lock</p>
      <input
        type="tel"
        value={whatsapp}
        onChange={(e) => setWhatsapp(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSubmit({ whatsappNumber: whatsapp })}
        className="border border-ink/12 px-2 py-1 text-[12px] text-chalk"
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
    <div className="border border-ink/12 p-2">
      <p className="mb-2 text-[12px] text-chalk">Adjust price</p>
      <input
        type="number"
        min={1}
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
      />
      <select
        value={reasonCode}
        onChange={(e) => setReasonCode(e.target.value)}
        disabled={disabled}
        className="mb-2 w-full border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
        className="mb-2 w-full border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
    <div className="border border-ink/12 p-2">
      <p className="mb-2 text-[12px] text-chalk">Upload photo</p>
      <input
        type="text"
        value={stage}
        onChange={(e) => setStage(e.target.value)}
        disabled={disabled || uploading}
        className="mb-2 w-full border border-ink/15 bg-milk px-2 py-2 text-[13px] text-ink"
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
