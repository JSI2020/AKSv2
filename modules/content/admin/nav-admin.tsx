"use client";

import { useState, useTransition } from "react";

import {
  deleteNavItemAction,
  saveNavItemAction,
} from "@/modules/content/actions";

type Row = {
  id: string;
  area: "HEADER" | "FOOTER";
  columnKey: string | null;
  label: string;
  link: { type: string; value: string };
  sortOrder: number;
  active: boolean;
};

const emptyForm = {
  label: "",
  area: "HEADER" as "HEADER" | "FOOTER",
  linkType: "hash",
  linkValue: "#cats",
  columnKey: "",
  active: true,
};

export function NavAdmin({ initial }: { initial: Row[] }) {
  const [rows, setRows] = useState(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setMsg(null);
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setForm({
      label: row.label,
      area: row.area,
      linkType: row.link.type,
      linkValue: row.link.value,
      columnKey: row.columnKey ?? "",
      active: row.active,
    });
    setMsg(null);
  }

  return (
    <div className="mt-6 space-y-6">
      <form
        className="grid max-w-2xl gap-3 border border-indigo-lift p-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const sortOrder = editingId
              ? (rows.find((r) => r.id === editingId)?.sortOrder ?? 0)
              : rows.filter((r) => r.area === form.area).length;
            const res = await saveNavItemAction({
              id: editingId ?? undefined,
              area: form.area,
              columnKey: form.columnKey,
              label: form.label,
              linkType: form.linkType,
              linkValue: form.linkValue,
              sortOrder,
              active: form.active,
            });
            if (!res.ok || !res.id) {
              setMsg(res.ok ? "Save failed." : res.error);
              return;
            }
            const next: Row = {
              id: res.id,
              area: form.area,
              columnKey: form.columnKey || null,
              label: form.label,
              link: { type: form.linkType, value: form.linkValue },
              sortOrder,
              active: form.active,
            };
            setRows((r) =>
              editingId
                ? r.map((x) => (x.id === editingId ? next : x))
                : [...r, next],
            );
            setMsg(editingId ? "Nav item updated." : "Nav item added.");
            startCreate();
          });
        }}
      >
        <p className="md:col-span-2 text-[12px] text-chalk">
          {editingId ? "Editing existing item" : "Add a new header or footer link"}
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Label</span>
          <input
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Area</span>
          <select
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.area}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                area: e.target.value as "HEADER" | "FOOTER",
              }))
            }
          >
            <option value="HEADER">Header</option>
            <option value="FOOTER">Footer</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Link type</span>
          <select
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.linkType}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkType: e.target.value }))
            }
          >
            <option value="hash">Hash</option>
            <option value="collection">Collection</option>
            <option value="page">Page</option>
            <option value="design">Design</option>
            <option value="url">URL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[11px] uppercase text-chalk">Link value</span>
          <input
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.linkValue}
            onChange={(e) =>
              setForm((f) => ({ ...f, linkValue: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-[11px] uppercase text-chalk">
            Footer column (shop / atelier / stay)
          </span>
          <input
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
            value={form.columnKey}
            onChange={(e) =>
              setForm((f) => ({ ...f, columnKey: e.target.value }))
            }
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-greige md:col-span-2">
          <input
            type="checkbox"
            checked={form.active}
            onChange={(e) =>
              setForm((f) => ({ ...f, active: e.target.checked }))
            }
          />
          Active
        </label>
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <button
            type="submit"
            disabled={pending}
            className="border border-zari px-3 py-1.5 text-[12px] uppercase text-zari"
          >
            {editingId ? "Save changes" : "Add item"}
          </button>
          {editingId ? (
            <button
              type="button"
              className="border border-indigo-lift px-3 py-1.5 text-[12px] uppercase text-chalk"
              onClick={startCreate}
            >
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-[13px] text-greige"
          >
            <span>
              <span className="text-chalk">{row.area}</span>
              {row.active ? "" : " · off"} · {row.label} → {row.link.type}:
              {row.link.value}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                className="text-[11px] uppercase text-zari"
                onClick={() => startEdit(row)}
              >
                Edit
              </button>
              <button
                type="button"
                className="text-[11px] uppercase text-madder"
                onClick={() => {
                  start(async () => {
                    const res = await deleteNavItemAction(row.id);
                    if (res.ok) {
                      setRows((r) => r.filter((x) => x.id !== row.id));
                      if (editingId === row.id) startCreate();
                    } else setMsg(res.error);
                  });
                }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
      {msg ? <p className="text-[12px] text-chalk">{msg}</p> : null}
    </div>
  );
}
