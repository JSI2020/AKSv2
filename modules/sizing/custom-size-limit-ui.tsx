"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Measure } from "@/modules/ui";

import {
  createCustomSizeLimit,
  updateCustomSizeLimit,
  type CustomSizeLimitAdminRow,
} from "@/modules/measure";

type ListProps = {
  limits: CustomSizeLimitAdminRow[];
};

export function CustomSizeLimitList({ limits }: ListProps) {
  return (
    <div className="border border-indigo-lift">
      <div className="border-b border-indigo-lift px-3 py-2">
        <p className="font-sans text-[12px] uppercase tracking-[0.12em] text-chalk">
          Custom limits · {limits.length}
        </p>
      </div>
      <ul className="divide-y divide-indigo-lift">
        {limits.map((row) => (
          <li key={row.id}>
            <a
              href={`/admin/settings/sizing/custom-limits/${row.id}`}
              className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-3 hover:bg-indigo-lift/40"
            >
              <div>
                <p className="text-[13px] text-greige">
                  {row.categoryName} · {row.measurementKey}
                </p>
                <p className="font-data text-[11px] text-chalk">
                  {row.categoryKey}
                </p>
              </div>
              <p className="font-data text-[11px] text-chalk">
                <Measure value={row.minValue} /> – <Measure value={row.maxValue} /> ·
                step <Measure value={row.step} />
              </p>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type FormProps = {
  limit: CustomSizeLimitAdminRow | null;
  categories: { id: string; key: string; name: string }[];
  measurementKeys: { key: string; label: string }[];
  mode: "create" | "edit";
};

export function CustomSizeLimitForm({
  limit,
  categories,
  measurementKeys,
  mode,
}: FormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState(limit?.categoryId ?? "");
  const [measurementKey, setMeasurementKey] = useState(
    limit?.measurementKey ?? "",
  );
  const [minDisplay, setMinDisplay] = useState(
    limit ? String(limit.minValue / 100) : "",
  );
  const [maxDisplay, setMaxDisplay] = useState(
    limit ? String(limit.maxValue / 100) : "",
  );
  const [stepDisplay, setStepDisplay] = useState(
    limit ? String(limit.step / 100) : "0.25",
  );
  const [rulesJson, setRulesJson] = useState(
    JSON.stringify(limit?.crossFieldRules ?? [], null, 2),
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const minValue = Math.round(Number(minDisplay) * 100);
    const maxValue = Math.round(Number(maxDisplay) * 100);
    const step = Math.round(Number(stepDisplay) * 100);

    const fd = new FormData();
    if (mode === "edit" && limit) fd.set("id", limit.id);
    if (mode === "create") {
      fd.set("categoryId", categoryId);
      fd.set("measurementKey", measurementKey);
    }
    fd.set("minValue", String(minValue));
    fd.set("maxValue", String(maxValue));
    fd.set("step", String(step));
    fd.set("crossFieldRules", rulesJson);

    startTransition(async () => {
      const result =
        mode === "edit"
          ? await updateCustomSizeLimit(fd)
          : await createCustomSizeLimit(fd);
      if (!result.ok) {
        setError(result.error ?? "Save failed");
        return;
      }
      router.push("/admin/settings/sizing/custom-limits");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-xl flex-col gap-4">
      {mode === "create" ? (
        <>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
              Category
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
            >
              <option value="">Select…</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.key})
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
              Measurement key
            </span>
            <select
              value={measurementKey}
              onChange={(e) => setMeasurementKey(e.target.value)}
              required
              className="border border-indigo-lift bg-indigo px-3 py-2 text-[13px] text-greige"
            >
              <option value="">Select…</option>
              {measurementKeys.map((k) => (
                <option key={k.key} value={k.key}>
                  {k.label} ({k.key})
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <p className="text-[13px] text-greige">
          {limit?.categoryName} · {limit?.measurementKey}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
            Min (in)
          </span>
          <input
            value={minDisplay}
            onChange={(e) => setMinDisplay(e.target.value)}
            required
            className="border border-indigo-lift bg-indigo px-3 py-2 font-data text-[13px] text-greige"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
            Max (in)
          </span>
          <input
            value={maxDisplay}
            onChange={(e) => setMaxDisplay(e.target.value)}
            required
            className="border border-indigo-lift bg-indigo px-3 py-2 font-data text-[13px] text-greige"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
            Step (in)
          </span>
          <input
            value={stepDisplay}
            onChange={(e) => setStepDisplay(e.target.value)}
            required
            className="border border-indigo-lift bg-indigo px-3 py-2 font-data text-[13px] text-greige"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-[12px] uppercase tracking-[0.08em] text-chalk">
          Cross-field rules (JSON)
        </span>
        <textarea
          value={rulesJson}
          onChange={(e) => setRulesJson(e.target.value)}
          rows={6}
          className="border border-indigo-lift bg-indigo px-3 py-2 font-data text-[12px] text-greige"
        />
      </label>

      {error ? <p className="text-[13px] text-madder">{error}</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="w-fit border border-zari px-4 py-2 text-[13px] text-zari"
      >
        {mode === "edit" ? "Save" : "Create"}
      </button>
    </form>
  );
}
