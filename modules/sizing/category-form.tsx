"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { MeasurementKeyCode } from "@aks/shared";

import {
  createGarmentCategory,
  updateGarmentCategory,
  type GarmentCategoryRow,
  type MeasurementKeyRow,
} from "./actions";

type Props = {
  category: GarmentCategoryRow | null;
  allKeys: MeasurementKeyRow[];
  mode: "create" | "edit";
};

export function CategoryForm({ category, allKeys, mode }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(category?.name ?? "");
  const [nameUr, setNameUr] = useState(category?.nameUr ?? "");
  const [key, setKey] = useState(category?.key ?? "");
  const [sortOrder, setSortOrder] = useState(String(category?.sortOrder ?? 100));
  const [active, setActive] = useState(category?.active ?? true);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(category?.measurementKeys ?? []),
  );

  const orderedKeys = useMemo(
    () => [...allKeys].sort((a, b) => a.key.localeCompare(b.key)),
    [allKeys],
  );

  function toggleKey(code: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const keys = [...selected] as MeasurementKeyCode[];
    if (keys.length === 0) {
      setError("Select at least one measurement key");
      return;
    }

    const fd = new FormData();
    fd.set("name", name);
    fd.set("nameUr", nameUr);
    fd.set("sortOrder", sortOrder);
    fd.set("active", active ? "true" : "false");
    fd.set("measurementKeys", JSON.stringify(keys));

    startTransition(async () => {
      const result =
        mode === "edit" && category
          ? (() => {
              fd.set("id", category.id);
              return updateGarmentCategory(fd);
            })()
          : (() => {
              fd.set("key", key);
              return createGarmentCategory(fd);
            })();

      const res = await result;
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/settings/sizing/categories");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex max-w-2xl flex-col gap-4">
      {mode === "create" ? (
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Key
          </span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            required
            pattern="[A-Z0-9_]+"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
          />
        </label>
      ) : (
        <p className="font-data text-[12px] text-chalk">
          Key · {category?.key}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Name (Urdu)
        </span>
        <input
          value={nameUr}
          onChange={(e) => setNameUr(e.target.value)}
          required
          dir="rtl"
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Sort order
        </span>
        <input
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 font-data text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>

      {mode === "edit" ? (
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            className="size-3.5 accent-zari"
          />
          Active
        </label>
      ) : null}

      <fieldset className="border border-indigo-lift p-3">
        <legend className="px-1 font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Measurement keys
        </legend>
        <p className="mb-2 text-[12px] text-chalk">
          Values are stored as integer hundredths of an inch.
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {orderedKeys.map((mk) => (
            <li key={mk.key}>
              <label className="flex cursor-pointer items-start gap-2 text-[13px] text-greige">
                <input
                  type="checkbox"
                  checked={selected.has(mk.key)}
                  onChange={() => toggleKey(mk.key)}
                  className="mt-0.5 size-3.5 accent-zari"
                />
                <span>
                  <span className="font-data text-[12px]">{mk.key}</span>
                  <span className="ms-1 text-chalk">· {mk.label}</span>
                  <span className="ms-1 font-sans text-[10px] uppercase tracking-[0.08em] text-chalk">
                    {mk.bodyOrGarment}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
        >
          {pending ? "Saving…" : mode === "create" ? "Create" : "Save"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/admin/settings/sizing/categories")}
          className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
