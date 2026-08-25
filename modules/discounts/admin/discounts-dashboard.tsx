"use client";

import { useMemo, useState, useTransition } from "react";

import { Money } from "@/modules/ui";
import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";

import { saveDiscount } from "../actions";
import {
  formatPreviewSentence,
  previewDiscountOnSampleOrder,
} from "../compute";
import type { DiscountListRow } from "../queries";

const SAMPLE_SUBTOTAL_MINOR = 30_000_00;

type PublishedDesignOpt = { id: string; name: string };

type FormState = {
  id: string;
  name: string;
  code: string;
  type: DiscountListRow["type"];
  value: string;
  appliesTo: DiscountListRow["appliesTo"];
  targetIds: string;
  minSpendMinor: string;
  maxDiscountMinor: string;
  firstOrderOnly: boolean;
  oncePerCustomer: boolean;
  usageLimit: string;
  startsAt: string;
  endsAt: string;
  stackable: boolean;
  status: DiscountListRow["status"];
};

const EMPTY_FORM: FormState = {
  id: "",
  name: "",
  code: "",
  type: "PERCENTAGE",
  value: "15",
  appliesTo: "ORDER",
  targetIds: "",
  minSpendMinor: "2500000",
  maxDiscountMinor: "",
  firstOrderOnly: true,
  oncePerCustomer: true,
  usageLimit: "1",
  startsAt: "",
  endsAt: "",
  stackable: false,
  status: "ACTIVE",
};

function toDatetimeLocal(value: Date | null): string {
  if (!value) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}T${pad(value.getHours())}:${pad(value.getMinutes())}`;
}

function rowToForm(row: DiscountListRow): FormState {
  return {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    type: row.type,
    value: String(row.value),
    appliesTo: row.appliesTo,
    targetIds: row.targetIds.join(", "),
    minSpendMinor: String(row.minSpendMinor),
    maxDiscountMinor:
      row.maxDiscountMinor != null ? String(row.maxDiscountMinor) : "",
    firstOrderOnly: row.firstOrderOnly,
    oncePerCustomer: row.oncePerCustomer,
    usageLimit: row.usageLimit != null ? String(row.usageLimit) : "",
    startsAt: toDatetimeLocal(row.startsAt),
    endsAt: toDatetimeLocal(row.endsAt),
    stackable: row.stackable,
    status: row.status,
  };
}

function StatusBadge({ status }: { status: DiscountListRow["status"] }) {
  const tone =
    status === "ACTIVE"
      ? "text-zari border-zari"
      : status === "PAUSED"
        ? "text-chalk border-chalk"
        : status === "EXPIRED"
          ? "text-madder border-madder"
          : "text-chalk/70 border-indigo-lift";
  return (
    <span className={`border px-2 py-0.5 text-[11px] uppercase ${tone}`}>
      {status.replace("_", " ")}
    </span>
  );
}

function scopePreviewLine(
  form: FormState,
  designs: PublishedDesignOpt[],
): string {
  const value = form.value.trim() || "0";
  const kind =
    form.type === "PERCENTAGE"
      ? `${value}% off`
      : form.type === "FIXED_AMOUNT"
        ? `PKR ${Number(value).toLocaleString("en-PK")} off`
        : "Free shipping";
  const auto = form.code.trim() ? `Code ${form.code.trim().toUpperCase()}` : "Automatic";
  const target = form.targetIds.split(/[\n,]/)[0]?.trim() ?? "";
  if (form.appliesTo === "ORDER") {
    return `${auto} · ${kind} on the whole order`;
  }
  if (form.appliesTo === "CATEGORY" || form.appliesTo === "COLLECTION") {
    const house = HOUSE_COLLECTIONS.find(
      (c) => c.tag === target.toUpperCase() || c.slug === target.toLowerCase(),
    );
    return `${auto} · ${kind} on category: ${house?.navLabel ?? (target || "…")}`;
  }
  if (form.appliesTo === "DESIGN") {
    const d = designs.find((x) => x.id === target);
    return `${auto} · ${kind} on style: ${d?.name ?? (target || "…")}`;
  }
  return `${auto} · ${kind}`;
}

export function DiscountsDashboard({
  rows,
  publishedDesigns = [],
}: {
  rows: DiscountListRow[];
  publishedDesigns?: PublishedDesignOpt[];
}) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const preview = useMemo(() => {
    const value = Number.parseInt(form.value, 10);
    const minSpendMinor = Number.parseInt(form.minSpendMinor, 10);
    const maxDiscountMinor = form.maxDiscountMinor.trim()
      ? Number.parseInt(form.maxDiscountMinor, 10)
      : null;

    if (
      !Number.isInteger(value) ||
      !Number.isInteger(minSpendMinor) ||
      (form.maxDiscountMinor.trim() &&
        !Number.isInteger(maxDiscountMinor ?? Number.NaN))
    ) {
      return null;
    }

    const result = previewDiscountOnSampleOrder(
      {
        type: form.type,
        value,
        minSpendMinor,
        maxDiscountMinor,
      },
      SAMPLE_SUBTOTAL_MINOR,
    );

    return {
      ...result,
      sentence: formatPreviewSentence(SAMPLE_SUBTOTAL_MINOR, result.totalMinor),
    };
  }, [form]);

  function selectRow(row: DiscountListRow) {
    setForm(rowToForm(row));
    setMessage(null);
  }

  function resetForm() {
    setForm(EMPTY_FORM);
    setMessage(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await saveDiscount(data);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage(form.id ? "Discount updated." : "Discount created.");
      if (!form.id) {
        setForm({ ...EMPTY_FORM, id: result.id });
      }
    });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="border border-indigo-lift">
        <div className="border-b border-indigo-lift px-4 py-3">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            All discounts
          </h2>
        </div>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-[13px] text-chalk">
            No discounts yet — create your first welcome code on the right.
          </p>
        ) : (
          <ul className="divide-y divide-indigo-lift">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => selectRow(row)}
                  className="block w-full px-4 py-3 text-start hover:bg-indigo-lift/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-[13px] text-greige">{row.name}</p>
                      <p className="mt-1 text-[12px] text-chalk">
                        {row.code ?? "Automatic"} · {row.type.replace("_", " ")}
                        {row.type === "PERCENTAGE" ? ` ${row.value}%` : null}
                      </p>
                    </div>
                    <StatusBadge status={row.status} />
                  </div>
                  <div className="mt-2 flex flex-wrap gap-4 text-[12px] text-chalk">
                    <span>
                      Used {row.usageCount}
                      {row.usageLimit != null ? ` / ${row.usageLimit}` : ""}
                    </span>
                    <span>{row.redemptionCount} orders</span>
                    <span>
                      <Money value={row.redeemedMinor} /> off
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="border border-indigo-lift p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            {form.id ? "Edit discount" : "New discount"}
          </h2>
          {form.id ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-[12px] text-chalk underline"
            >
              New instead
            </button>
          ) : null}
        </div>

        {preview ? (
          <p className="mt-4 border border-zari px-3 py-2 text-[13px] text-greige">
            {preview.sentence}
            {preview.discountMinor > 0 ? (
              <>
                {" "}
                (<Money value={preview.discountMinor} className="inline" /> off)
              </>
            ) : (
              " — minimum spend not met on the sample order."
            )}
          </p>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <input type="hidden" name="id" value={form.id} />

          <Field label="Name">
            <input
              name="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              required
            />
          </Field>

          <Field label="Code (leave blank for automatic)">
            <input
              name="code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              placeholder="WELCOME15"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type">
              <select
                name="type"
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value as FormState["type"],
                  })
                }
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED_AMOUNT">Fixed amount</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </select>
            </Field>

            <Field label="Value">
              <input
                name="value"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
                required
              />
            </Field>
          </div>

          <Field label="Applies to">
            <select
              name="appliesTo"
              value={
                form.appliesTo === "COLLECTION" ? "CATEGORY" : form.appliesTo
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  appliesTo: e.target.value as FormState["appliesTo"],
                  targetIds: "",
                })
              }
              className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
            >
              <option value="ORDER">Whole order</option>
              <option value="CATEGORY">A category</option>
              <option value="DESIGN">One specific style</option>
            </select>
          </Field>

          {form.appliesTo === "CATEGORY" || form.appliesTo === "COLLECTION" ? (
            <Field label="Which category">
              <select
                name="targetIds"
                value={form.targetIds.split(/[\n,]/)[0]?.trim() ?? ""}
                onChange={(e) =>
                  setForm({ ...form, targetIds: e.target.value })
                }
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
              >
                <option value="">Select…</option>
                {HOUSE_COLLECTIONS.map((c) => (
                  <option key={c.tag} value={c.tag}>
                    {c.navLabel}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {form.appliesTo === "DESIGN" ? (
            <Field label="Which style">
              <select
                name="targetIds"
                value={form.targetIds.split(/[\n,]/)[0]?.trim() ?? ""}
                onChange={(e) =>
                  setForm({ ...form, targetIds: e.target.value })
                }
                className="w-full border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
              >
                <option value="">Select…</option>
                {publishedDesigns.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}

          {form.appliesTo === "ORDER" ? (
            <input type="hidden" name="targetIds" value="" />
          ) : null}

          <div className="border border-ink/12 bg-greige px-4 py-3 text-[12.5px] text-ink/70">
            {scopePreviewLine(form, publishedDesigns)}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum spend (paisa)">
              <input
                name="minSpendMinor"
                value={form.minSpendMinor}
                onChange={(e) =>
                  setForm({ ...form, minSpendMinor: e.target.value })
                }
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              />
            </Field>
            <Field label="Max discount cap (paisa)">
              <input
                name="maxDiscountMinor"
                value={form.maxDiscountMinor}
                onChange={(e) =>
                  setForm({ ...form, maxDiscountMinor: e.target.value })
                }
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              />
            </Field>
          </div>

          <Field label="Usage limit (blank = unlimited)">
            <input
              name="usageLimit"
              value={form.usageLimit}
              onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
              className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Starts at">
              <input
                type="datetime-local"
                name="startsAt"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              />
            </Field>
            <Field label="Ends at">
              <input
                type="datetime-local"
                name="endsAt"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
              />
            </Field>
          </div>

          <Field label="Status">
            <select
              name="status"
              value={form.status}
              onChange={(e) =>
                setForm({
                  ...form,
                  status: e.target.value as FormState["status"],
                })
              }
              className="w-full border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
            >
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">Paused</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </Field>

          <div className="space-y-2 text-[13px] text-greige">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="firstOrderOnly"
                checked={form.firstOrderOnly}
                onChange={(e) =>
                  setForm({ ...form, firstOrderOnly: e.target.checked })
                }
              />
              First order only
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="oncePerCustomer"
                checked={form.oncePerCustomer}
                onChange={(e) =>
                  setForm({ ...form, oncePerCustomer: e.target.checked })
                }
              />
              Once per customer
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="stackable"
                checked={form.stackable}
                onChange={(e) =>
                  setForm({ ...form, stackable: e.target.checked })
                }
              />
              Stackable with other discounts
            </label>
          </div>

          {message ? (
            <p
              className={`text-[13px] ${message.includes("not") || message.includes("Could") ? "text-madder" : "text-zari"}`}
              role="status"
            >
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="w-full border border-zari px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-zari disabled:opacity-40"
          >
            {pending ? "Saving…" : form.id ? "Update discount" : "Create discount"}
          </button>
        </form>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] uppercase tracking-[0.08em] text-chalk">
        {label}
      </span>
      {children}
    </label>
  );
}
