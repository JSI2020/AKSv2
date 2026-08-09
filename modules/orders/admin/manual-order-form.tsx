"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";

import {
  computeDepositAmounts,
  getAvailablePaymentPlans,
  PAKISTAN_PROVINCES,
  type PaymentPlan,
} from "@/modules/checkout/payment-plans";
import { useCan } from "@/modules/auth/use-can";
import { Money } from "@/modules/ui";
import { ORDER_PRICE_ADJUSTMENT_REASONS } from "@/modules/orders/reason-codes";

import {
  loadManualOrderDesignDetailAction,
  placeManualOrderAction,
  searchCustomersAction,
} from "../manual/actions";
import {
  MANUAL_DEPOSIT_PROVIDERS,
  MANUAL_ORDER_SOURCES,
  type CustomerSearchResult,
  type ManualOrderDesignDetail,
  type ManualOrderDesignOption,
  type ManualOrderLineInput,
  type ManualOrderSource,
  type PlaceManualOrderInput,
} from "../manual/types";

const inputClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari";
const labelClass =
  "font-sans text-[11px] uppercase tracking-[0.12em] text-chalk";

type DraftLine = ManualOrderLineInput & {
  clientId: string;
  designDetail: ManualOrderDesignDetail | null;
  loadingDesign: boolean;
};

type ManualOrderFormProps = {
  designs: ManualOrderDesignOption[];
};

function emptyLine(): DraftLine {
  return {
    clientId: crypto.randomUUID(),
    designId: "",
    colourwayId: "",
    sizeMode: "STANDARD",
    sizeLabel: null,
    measurements: {},
    customizationSelections: {},
    quantity: 1,
    designDetail: null,
    loadingDesign: false,
  };
}

export function ManualOrderForm({ designs }: ManualOrderFormProps) {
  const router = useRouter();
  const canCreate = useCan("orders.create");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [source, setSource] = useState<ManualOrderSource>("WHATSAPP");
  const [customerMode, setCustomerMode] = useState<"existing" | "new">("new");
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerResults, setCustomerResults] = useState<CustomerSearchResult[]>(
    [],
  );
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
    null,
  );
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    email: "",
    phone: "",
    whatsappNumber: "",
  });

  const [address, setAddress] = useState({
    recipientName: "",
    phone: "",
    whatsappNumber: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    province: "PUNJAB" as const,
    postalCode: "",
    landmark: "",
  });

  const [lines, setLines] = useState<DraftLine[]>([emptyLine()]);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlan>("DEPOSIT_70_COD_30");
  const [adjustPrice, setAdjustPrice] = useState(false);
  const [adjustedTotalMinor, setAdjustedTotalMinor] = useState<number | "">("");
  const [adjustReasonCode, setAdjustReasonCode] = useState("");
  const [adjustNote, setAdjustNote] = useState("");
  const [recordDeposit, setRecordDeposit] = useState(false);
  const [depositAmountMinor, setDepositAmountMinor] = useState<number | "">("");
  const [depositProvider, setDepositProvider] =
    useState<(typeof MANUAL_DEPOSIT_PROVIDERS)[number]["value"]>("BANK_TRANSFER");
  const [depositNote, setDepositNote] = useState("");
  const [customerNotes, setCustomerNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const computedSubtotalMinor = useMemo(() => {
    return lines.reduce((sum, line) => {
      const detail = line.designDetail;
      if (!detail) return sum;
      const cw = detail.colourways.find((c) => c.id === line.colourwayId);
      if (!cw) return sum;
      let unit =
        detail.basePriceMinor +
        cw.priceDeltaMinor +
        (line.sizeMode === "MADE_TO_MEASURE"
          ? detail.madeToMeasureSurchargeMinor
          : 0);
      for (const opt of detail.customizationOptions) {
        const selected = line.customizationSelections[opt.key];
        if (opt.inputType === "BOOLEAN" && selected === true) {
          const match = opt.values.find((v) => v.value === "true");
          unit += match?.priceDeltaMinor ?? 0;
        } else if (typeof selected === "string" && selected) {
          const match = opt.values.find((v) => v.value === selected);
          unit += match?.priceDeltaMinor ?? 0;
        }
      }
      return sum + unit * line.quantity;
    }, 0);
  }, [lines]);

  const totalMinor =
    adjustPrice && typeof adjustedTotalMinor === "number"
      ? adjustedTotalMinor
      : computedSubtotalMinor;

  const depositPreview = computeDepositAmounts({
    totalMinor,
    plan: paymentPlan,
  });

  const paymentPlanOptions = getAvailablePaymentPlans(
    lines.map((l) => ({ sizeMode: l.sizeMode })),
  );

  useEffect(() => {
    const selected = paymentPlanOptions.find((p) => p.plan === paymentPlan);
    if (selected?.disabled) {
      setPaymentPlan("DEPOSIT_70_COD_30");
    }
  }, [paymentPlan, paymentPlanOptions]);

  const searchCustomers = useCallback((query: string) => {
    if (query.trim().length < 2) {
      setCustomerResults([]);
      return;
    }
    void searchCustomersAction(query).then((result) => {
      if (result.ok) setCustomerResults(result.customers);
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => searchCustomers(customerQuery), 250);
    return () => clearTimeout(timer);
  }, [customerQuery, searchCustomers]);

  function fillAddressFromCustomer(customer: CustomerSearchResult) {
    setAddress((prev) => ({
      ...prev,
      recipientName: customer.name ?? prev.recipientName,
      phone: customer.phone ?? prev.phone,
      whatsappNumber: customer.phone ?? prev.whatsappNumber,
    }));
  }

  function fillAddressFromNewCustomer() {
    setAddress((prev) => ({
      ...prev,
      recipientName: newCustomer.name || prev.recipientName,
      phone: newCustomer.phone || prev.phone,
      whatsappNumber: newCustomer.whatsappNumber || prev.whatsappNumber,
    }));
  }

  async function loadDesignDetail(clientId: string, designId: string) {
    setLines((prev) =>
      prev.map((line) =>
        line.clientId === clientId
          ? { ...line, loadingDesign: true, designId }
          : line,
      ),
    );

    const result = await loadManualOrderDesignDetailAction(designId);
    setLines((prev) =>
      prev.map((line) => {
        if (line.clientId !== clientId) return line;
        if (!result.ok) {
          return {
            ...line,
            designDetail: null,
            loadingDesign: false,
            colourwayId: "",
          };
        }
        const defaultCw =
          result.design.colourways.find((c) => c.isDefault) ??
          result.design.colourways[0];
        return {
          ...line,
          designDetail: result.design,
          loadingDesign: false,
          colourwayId: defaultCw?.id ?? "",
          sizeLabel: result.design.sizeLabels[0] ?? null,
          measurements: {},
        };
      }),
    );
  }

  function updateLine(clientId: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((line) =>
        line.clientId === clientId ? { ...line, ...patch } : line,
      ),
    );
  }

  function removeLine(clientId: string) {
    setLines((prev) =>
      prev.length <= 1 ? prev : prev.filter((line) => line.clientId !== clientId),
    );
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (customerMode === "existing" && !selectedCustomerId) {
      setError("Select a customer or switch to create new.");
      return;
    }

    if (customerMode === "new") {
      fillAddressFromNewCustomer();
    }

    const payload: PlaceManualOrderInput = {
      source,
      customer:
        customerMode === "existing" && selectedCustomerId
          ? { mode: "existing", userId: selectedCustomerId }
          : {
              mode: "new",
              name: newCustomer.name,
              email: newCustomer.email || undefined,
              phone: newCustomer.phone,
              whatsappNumber: newCustomer.whatsappNumber,
            },
      address,
      lines: lines.map((line) => {
        const {
          clientId: _clientId,
          designDetail: _designDetail,
          loadingDesign: _loadingDesign,
          ...rest
        } = line;
        return rest;
      }),
      paymentPlan,
      priceAdjustment:
        adjustPrice &&
        typeof adjustedTotalMinor === "number" &&
        adjustedTotalMinor !== computedSubtotalMinor
          ? {
              newTotalMinor: adjustedTotalMinor,
              reasonCode: adjustReasonCode,
              note: adjustNote || undefined,
            }
          : undefined,
      deposit:
        recordDeposit && typeof depositAmountMinor === "number"
          ? {
              amountMinor: depositAmountMinor,
              provider: depositProvider,
              note: depositNote || undefined,
            }
          : undefined,
      customerNotes: customerNotes || undefined,
      internalNotes: internalNotes || undefined,
    };

    startTransition(async () => {
      const result = await placeManualOrderAction(payload);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/admin/orders/${result.orderId}`);
      router.refresh();
    });
  }

  if (!canCreate) {
    return (
      <p className="text-[13px] text-chalk">
        You do not have permission to create orders.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-3xl flex-col gap-8">
      <Section title="Source">
        <div className="flex flex-wrap gap-2">
          {MANUAL_ORDER_SOURCES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setSource(option.value)}
              className={`border px-3 py-1.5 text-[13px] ${
                source === option.value
                  ? "border-zari bg-zari text-indigo"
                  : "border-indigo-lift text-greige hover:border-chalk"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Customer">
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => setCustomerMode("new")}
            className={`border px-2 py-1 text-[12px] ${
              customerMode === "new"
                ? "border-zari text-zari"
                : "border-indigo-lift text-chalk"
            }`}
          >
            Create new
          </button>
          <button
            type="button"
            onClick={() => setCustomerMode("existing")}
            className={`border px-2 py-1 text-[12px] ${
              customerMode === "existing"
                ? "border-zari text-zari"
                : "border-indigo-lift text-chalk"
            }`}
          >
            Existing customer
          </button>
        </div>

        {customerMode === "existing" ? (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className={labelClass}>Search</span>
              <input
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                placeholder="Name, email, or phone"
                className={inputClass}
              />
            </label>
            {customerResults.length > 0 ? (
              <ul className="border border-indigo-lift">
                {customerResults.map((customer) => (
                  <li key={customer.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(customer.id);
                        fillAddressFromCustomer(customer);
                      }}
                      className={`block w-full px-2 py-1.5 text-start text-[13px] hover:bg-indigo-lift ${
                        selectedCustomerId === customer.id
                          ? "bg-indigo-lift text-zari"
                          : "text-greige"
                      }`}
                    >
                      {customer.name ?? "Unnamed"} · {customer.email}
                      {customer.phone ? ` · ${customer.phone}` : ""}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" required>
              <input
                required
                value={newCustomer.name}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, name: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={newCustomer.email}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, email: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="Phone" required>
              <input
                required
                value={newCustomer.phone}
                onChange={(e) =>
                  setNewCustomer((c) => ({ ...c, phone: e.target.value }))
                }
                className={inputClass}
              />
            </Field>
            <Field label="WhatsApp" required>
              <input
                required
                value={newCustomer.whatsappNumber}
                onChange={(e) =>
                  setNewCustomer((c) => ({
                    ...c,
                    whatsappNumber: e.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
          </div>
        )}
      </Section>

      <Section title="Shipping address">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Recipient" required>
            <input
              required
              value={address.recipientName}
              onChange={(e) =>
                setAddress((a) => ({ ...a, recipientName: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Phone" required>
            <input
              required
              value={address.phone}
              onChange={(e) =>
                setAddress((a) => ({ ...a, phone: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="WhatsApp" required>
            <input
              required
              value={address.whatsappNumber}
              onChange={(e) =>
                setAddress((a) => ({ ...a, whatsappNumber: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Province" required>
            <select
              required
              value={address.province}
              onChange={(e) =>
                setAddress((a) => ({
                  ...a,
                  province: e.target.value as typeof address.province,
                }))
              }
              className={inputClass}
            >
              {PAKISTAN_PROVINCES.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Address line 1" required className="sm:col-span-2">
            <input
              required
              value={address.addressLine1}
              onChange={(e) =>
                setAddress((a) => ({ ...a, addressLine1: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Address line 2" className="sm:col-span-2">
            <input
              value={address.addressLine2}
              onChange={(e) =>
                setAddress((a) => ({ ...a, addressLine2: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="City" required>
            <input
              required
              value={address.city}
              onChange={(e) =>
                setAddress((a) => ({ ...a, city: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Postal code">
            <input
              value={address.postalCode}
              onChange={(e) =>
                setAddress((a) => ({ ...a, postalCode: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
          <Field label="Landmark" className="sm:col-span-2">
            <input
              value={address.landmark}
              onChange={(e) =>
                setAddress((a) => ({ ...a, landmark: e.target.value }))
              }
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      <Section title="Items">
        <div className="flex flex-col gap-4">
          {lines.map((line, index) => (
            <div
              key={line.clientId}
              className="border border-indigo-lift p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[12px] uppercase tracking-[0.08em] text-chalk">
                  Line {index + 1}
                </p>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(line.clientId)}
                    className="text-[12px] text-madder hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Design" required>
                  <select
                    required
                    value={line.designId}
                    onChange={(e) => {
                      const designId = e.target.value;
                      updateLine(line.clientId, { designId });
                      if (designId) void loadDesignDetail(line.clientId, designId);
                    }}
                    className={inputClass}
                  >
                    <option value="">Select design</option>
                    {designs.map((design) => (
                      <option key={design.id} value={design.id}>
                        {design.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Colourway" required>
                  <select
                    required
                    value={line.colourwayId}
                    disabled={!line.designDetail}
                    onChange={(e) =>
                      updateLine(line.clientId, { colourwayId: e.target.value })
                    }
                    className={inputClass}
                  >
                    <option value="">Select colourway</option>
                    {line.designDetail?.colourways.map((cw) => (
                      <option key={cw.id} value={cw.id}>
                        {cw.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Size mode" required>
                  <select
                    value={line.sizeMode}
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        sizeMode: e.target.value as "STANDARD" | "MADE_TO_MEASURE",
                        sizeLabel:
                          e.target.value === "STANDARD"
                            ? line.designDetail?.sizeLabels[0] ?? null
                            : null,
                        measurements: {},
                      })
                    }
                    className={inputClass}
                  >
                    <option value="STANDARD">Standard size</option>
                    <option value="MADE_TO_MEASURE">Made to measure</option>
                  </select>
                </Field>

                <Field label="Quantity" required>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    required
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(line.clientId, {
                        quantity: Number(e.target.value) || 1,
                      })
                    }
                    className={inputClass}
                  />
                </Field>

                {line.sizeMode === "STANDARD" ? (
                  <Field label="Size" required>
                    <select
                      required
                      value={line.sizeLabel ?? ""}
                      disabled={!line.designDetail}
                      onChange={(e) =>
                        updateLine(line.clientId, { sizeLabel: e.target.value })
                      }
                      className={inputClass}
                    >
                      <option value="">Select size</option>
                      {line.designDetail?.sizeLabels.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <div className="sm:col-span-2">
                    <p className={labelClass}>Measurements (inches)</p>
                    <p className="mb-2 text-[12px] text-chalk">
                      Enter body measurements. Stored as hundredths of an inch
                      internally.
                    </p>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {["LENGTH", "BUST", "WAIST", "HIP", "SHOULDER", "SLEEVE"].map(
                        (key) => {
                          const componentKey =
                            line.designDetail?.garmentCategoryKey ?? "KAMEEZ";
                          const mapKey = `${componentKey}:${key}`;
                          const stored = line.measurements[mapKey];
                          return (
                          <label key={key} className="flex flex-col gap-1">
                            <span className="text-[11px] text-chalk">{key}</span>
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              placeholder="e.g. 38"
                              value={stored ? stored / 100 : ""}
                              onChange={(e) => {
                                const raw = e.target.value;
                                if (!raw) {
                                  const next = { ...line.measurements };
                                  delete next[mapKey];
                                  updateLine(line.clientId, {
                                    measurements: next,
                                  });
                                  return;
                                }
                                const inches = Math.round(parseFloat(raw) * 100);
                                updateLine(line.clientId, {
                                  measurements: {
                                    ...line.measurements,
                                    [mapKey]: inches,
                                  },
                                });
                              }}
                              className={inputClass}
                            />
                          </label>
                          );
                        },
                      )}
                    </div>
                  </div>
                )}

                {line.designDetail?.customizationOptions.map((opt) => (
                  <Field key={opt.key} label={opt.label} required={opt.required}>
                    {opt.inputType === "BOOLEAN" ? (
                      <label className="flex items-center gap-2 text-[13px] text-greige">
                        <input
                          type="checkbox"
                          checked={line.customizationSelections[opt.key] === true}
                          onChange={(e) =>
                            updateLine(line.clientId, {
                              customizationSelections: {
                                ...line.customizationSelections,
                                [opt.key]: e.target.checked,
                              },
                            })
                          }
                        />
                        Yes
                      </label>
                    ) : (
                      <select
                        required={opt.required}
                        value={
                          (line.customizationSelections[opt.key] as string) ?? ""
                        }
                        onChange={(e) =>
                          updateLine(line.clientId, {
                            customizationSelections: {
                              ...line.customizationSelections,
                              [opt.key]: e.target.value,
                            },
                          })
                        }
                        className={inputClass}
                      >
                        {!opt.required ? <option value="">—</option> : null}
                        {opt.values.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                ))}
              </div>

              {line.loadingDesign ? (
                <p className="mt-2 text-[12px] text-chalk">Loading design…</p>
              ) : null}
            </div>
          ))}

          <button
            type="button"
            onClick={addLine}
            className="self-start border border-indigo-lift px-3 py-1.5 text-[13px] text-greige hover:border-zari"
          >
            Add another item
          </button>
        </div>
      </Section>

      <Section title="Totals">
        <dl className="grid gap-1 text-[13px]">
          <div className="flex justify-between text-chalk">
            <dt>Computed subtotal</dt>
            <dd>
              <Money value={computedSubtotalMinor} />
            </dd>
          </div>
          <div className="flex justify-between text-greige">
            <dt>Order total</dt>
            <dd>
              <Money value={totalMinor} />
            </dd>
          </div>
          <div className="flex justify-between text-chalk">
            <dt>Due now (deposit)</dt>
            <dd>
              <Money value={depositPreview.depositAmountMinor} />
            </dd>
          </div>
          <div className="flex justify-between text-chalk">
            <dt>Balance on delivery</dt>
            <dd>
              <Money value={depositPreview.balanceAmountMinor} />
            </dd>
          </div>
        </dl>

        <label className="mt-3 flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            checked={adjustPrice}
            onChange={(e) => setAdjustPrice(e.target.checked)}
          />
          Adjust total with a reason
        </label>

        {adjustPrice ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="New total (PKR paisa)" required>
              <input
                type="number"
                min={1}
                required
                value={adjustedTotalMinor}
                onChange={(e) =>
                  setAdjustedTotalMinor(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                placeholder={String(computedSubtotalMinor)}
                className={inputClass}
              />
            </Field>
            <Field label="Reason" required>
              <select
                required
                value={adjustReasonCode}
                onChange={(e) => setAdjustReasonCode(e.target.value)}
                className={inputClass}
              >
                <option value="">Select reason</option>
                {ORDER_PRICE_ADJUSTMENT_REASONS.map((r) => (
                  <option key={r.code} value={r.code}>
                    {r.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <input
                value={adjustNote}
                onChange={(e) => setAdjustNote(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Payment plan">
        <div className="flex flex-col gap-2">
          {paymentPlanOptions.map((option) => (
            <label
              key={option.plan}
              className={`flex cursor-pointer gap-2 border p-3 ${
                paymentPlan === option.plan
                  ? "border-zari"
                  : "border-indigo-lift"
              } ${option.disabled ? "opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="paymentPlan"
                value={option.plan}
                disabled={option.disabled}
                checked={paymentPlan === option.plan}
                onChange={() => setPaymentPlan(option.plan)}
              />
              <span>
                <span className="block text-[13px] text-greige">
                  {option.label}
                </span>
                <span className="block text-[12px] text-chalk">
                  {option.disabled
                    ? option.disabledReason
                    : option.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Deposit received">
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            checked={recordDeposit}
            onChange={(e) => {
              setRecordDeposit(e.target.checked);
              if (e.target.checked && depositAmountMinor === "") {
                setDepositAmountMinor(depositPreview.depositAmountMinor);
              }
            }}
          />
          Customer already paid a deposit
        </label>

        {recordDeposit ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field label="Amount (paisa)" required>
              <input
                type="number"
                min={1}
                required
                value={depositAmountMinor}
                onChange={(e) =>
                  setDepositAmountMinor(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className={inputClass}
              />
            </Field>
            <Field label="Received via" required>
              <select
                required
                value={depositProvider}
                onChange={(e) =>
                  setDepositProvider(
                    e.target.value as typeof depositProvider,
                  )
                }
                className={inputClass}
              >
                {MANUAL_DEPOSIT_PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note" className="sm:col-span-2">
              <input
                value={depositNote}
                onChange={(e) => setDepositNote(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        ) : null}
      </Section>

      <Section title="Notes">
        <div className="grid gap-3">
          <Field label="Customer notes">
            <textarea
              rows={2}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Internal notes">
            <textarea
              rows={2}
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>
      </Section>

      {error ? (
        <p className="border border-madder px-3 py-2 text-[13px] text-madder">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
        >
          {pending ? "Placing order…" : "Place order"}
        </button>
        <Link
          href="/admin/orders"
          className="text-[13px] text-chalk hover:text-greige"
        >
          Cancel
        </Link>
      </div>
    </form>
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
    <section className="border border-indigo-lift p-4">
      <h2 className="mb-3 font-sans text-[11px] uppercase tracking-[0.12em] text-zari">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className={labelClass}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
